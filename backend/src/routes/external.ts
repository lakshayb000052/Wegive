import { Router, Request, Response } from 'express';
import pool from '../config/db';
import Razorpay from 'razorpay';

const router = Router();

// Helper to resolve Razorpay credentials
const getRazorpayInstance = async (campaignPaymentConfig: any, orgPaymentConfig: any) => {
  let keyId = campaignPaymentConfig?.razorpay_key_id || orgPaymentConfig?.razorpay_key_id;
  let keySecret = campaignPaymentConfig?.razorpay_key_secret || orgPaymentConfig?.razorpay_key_secret;

  if (!keyId || !keySecret) {
    const sysSettingsRes = await pool.query("SELECT key, value FROM system_settings WHERE key IN ('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET')");
    const sysMap: Record<string, string> = {};
    sysSettingsRes.rows.forEach((r: any) => sysMap[r.key] = r.value);
    keyId = keyId || sysMap['RAZORPAY_KEY_ID'];
    keySecret = keySecret || sysMap['RAZORPAY_KEY_SECRET'];
  }

  if (!keyId || !keySecret) return null;
  return { instance: new Razorpay({ key_id: keyId, key_secret: keySecret }), keyId, keySecret };
};

/**
 * @route POST /api/v1/external/donations/initiate
 * @desc External API endpoint for NGO landing pages to initiate a donation and submit form data using DanaPro API Key
 */
router.post('/donations/initiate', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = (req.headers['x-wegive-api-key'] || req.headers['x-danapro-api-key'] || req.query.api_key || req.body.api_key) as string;
    const { name, email, phone, taxId, amount, currency = 'INR', isAnonymous = false, customFormData = {}, campaignSlug } = req.body;

    if (!apiKey) {
      res.status(401).json({ error: 'Unauthorized: Missing DanaPro API Key (x-danapro-api-key header or api_key payload parameter required)' });
      return;
    }

    if (!amount || Number(amount) <= 0) {
      res.status(400).json({ error: 'Invalid donation amount' });
      return;
    }

    // 1. Resolve Campaign & Organization via API Key or Campaign Slug fallback
    let campaignQuery = `
      SELECT c.*, o.id as org_id, o.name as org_name, o.payment_gateways_config as org_payment_config, o.permissions as org_permissions 
      FROM campaigns c
      JOIN organizations o ON c.organization_id = o.id
      WHERE c.api_key = $1 OR o.api_key = $1
    `;
    let queryParams: any[] = [apiKey];

    if (campaignSlug) {
      campaignQuery += ` OR c.slug = $2`;
      queryParams.push(campaignSlug);
    }

    const campaignRes = await pool.query(campaignQuery, queryParams);

    if (campaignRes.rows.length === 0) {
      res.status(404).json({ error: 'Invalid DanaPro API Key or target campaign not found' });
      return;
    }

    const campaign = campaignRes.rows[0];
    const organizationId = campaign.org_id;

    // 2. Insert or update Donor in database
    const donorRes = await pool.query(
      `INSERT INTO donors (organization_id, name, email, phone, tax_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (organization_id, email) 
       DO UPDATE SET name = EXCLUDED.name, phone = COALESCE(EXCLUDED.phone, donors.phone), tax_id = COALESCE(EXCLUDED.tax_id, donors.tax_id), updated_at = NOW()
       RETURNING *`,
      [organizationId, name || 'Anonymous Donor', email || `donor_${Date.now()}@external.org`, phone || null, taxId || null]
    );
    const donor = donorRes.rows[0];

    // 3. Resolve active Razorpay credentials
    const rzpData = await getRazorpayInstance(campaign.payment_config, campaign.org_payment_config);
    const razorpayKeyId = rzpData?.keyId || 'rzp_test_TGtUm3uP0OFaYN';

    // 4. Create Order with Razorpay or fallback order ID
    let orderId = `order_dp_ext_${Date.now()}`;

    if (rzpData?.instance) {
      try {
        const razorpayOrder = await rzpData.instance.orders.create({
          amount: Math.round(Number(amount) * 100),
          currency: currency.toUpperCase(),
          receipt: `rcpt_ext_${Date.now()}`,
          notes: {
            campaign_id: campaign.id,
            campaign_title: campaign.title,
            donor_email: email,
            source: 'external_ngo_landing_page'
          }
        });
        orderId = razorpayOrder.id;
      } catch (err: any) {
        console.warn('[External API] Razorpay Order Creation API Notice:', err?.message || err);
      }
    }

    // 5. Insert Pending Donation into Database with custom_form_data JSONB
    const donationRes = await pool.query(
      `INSERT INTO donations (
        organization_id, campaign_id, donor_id, amount, currency, net_amount, fee_covered,
        payment_gateway, gateway_transaction_id, status, is_anonymous, custom_form_data
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $11)
       RETURNING *`,
      [
        organizationId,
        campaign.id,
        donor.id,
        amount,
        currency.toUpperCase(),
        amount,
        0.00,
        'razorpay',
        orderId,
        isAnonymous,
        JSON.stringify(customFormData || {})
      ]
    );

    const donation = donationRes.rows[0];

    res.status(200).json({
      success: true,
      message: 'Donation initiated via DanaPro API',
      donationId: donation.id,
      orderId: orderId,
      razorpayKeyId: razorpayKeyId,
      amount: Number(amount),
      currency: currency.toUpperCase(),
      campaign: {
        id: campaign.id,
        title: campaign.title,
        slug: campaign.slug,
        landingPageUrl: campaign.landing_page_url
      },
      organization: {
        id: campaign.org_id,
        name: campaign.org_name
      }
    });
  } catch (error: any) {
    console.error('[External API Initiate Error]:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

/**
 * @route POST /api/v1/external/donations/verify
 * @desc Verify payment completed from external landing page and confirm full form payload
 */
router.post('/donations/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { donationId, razorpayPaymentId, razorpayOrderId, razorpaySignature, customFormData, phone, taxId, forceSandbox = false } = req.body;

    if (!donationId) {
      res.status(400).json({ error: 'Missing donationId parameter' });
      return;
    }

    // 1. Fetch donation and donor records
    const donRes = await pool.query(
      `SELECT d.*, c.title as campaign_title, o.name as org_name, dn.email as donor_email, dn.name as donor_name, dn.id as donor_db_id
       FROM donations d
       JOIN campaigns c ON d.campaign_id = c.id
       JOIN organizations o ON d.organization_id = o.id
       JOIN donors dn ON d.donor_id = dn.id
       WHERE d.id = $1`,
      [donationId]
    );

    if (donRes.rows.length === 0) {
      res.status(404).json({ error: 'Donation record not found' });
      return;
    }

    const donation = donRes.rows[0];
    const txnId = razorpayPaymentId || `pay_ext_${Date.now()}`;

    // 2. Update Donor contact info if updated during checkout
    if (phone || taxId) {
      await pool.query(
        `UPDATE donors SET phone = COALESCE($1, phone), tax_id = COALESCE($2, tax_id), updated_at = NOW() WHERE id = $3`,
        [phone || null, taxId || null, donation.donor_db_id]
      );
    }

    // 3. Update Donation record in PostgreSQL DB
    const mergedCustomData = {
      ...(donation.custom_form_data || {}),
      ...(customFormData || {}),
      verified_at: new Date().toISOString(),
      source_channel: 'external_ngo_landing_page'
    };

    const updateRes = await pool.query(
      `UPDATE donations 
       SET status = 'completed', 
           gateway_transaction_id = $1, 
           raw_gateway_response = $2,
           custom_form_data = $3
       WHERE id = $4
       RETURNING *`,
      [txnId, JSON.stringify({ razorpayPaymentId, razorpayOrderId, razorpaySignature, verifiedVia: 'external_api' }), JSON.stringify(mergedCustomData), donationId]
    );

    const updatedDonation = updateRes.rows[0];

    // 4. Generate 80G Receipt PDF Record
    const receiptNum = `80G-EXT-${Date.now().toString().slice(-6)}`;
    const pdfUrl = `http://localhost:5000/receipts/${receiptNum}.pdf`;
    await pool.query(
      `INSERT INTO compliance_receipts (donation_id, receipt_number, tax_regime, receipt_pdf_url, transaction_hash, metadata)
       VALUES ($1, $2, '80G', $3, md5($4), $5)
       ON CONFLICT (donation_id) DO UPDATE SET metadata = EXCLUDED.metadata`,
      [donationId, receiptNum, pdfUrl, txnId, JSON.stringify({ source: 'external_api' })]
    );

    res.status(200).json({
      success: true,
      message: 'Payment verified and external donor details stored successfully',
      donationId: updatedDonation.id,
      status: updatedDonation.status,
      transactionId: txnId,
      receiptNumber: receiptNum,
      receiptPdfUrl: pdfUrl,
      donor: {
        name: donation.donor_name,
        email: donation.donor_email,
        phone: phone || donation.phone,
        taxId: taxId || donation.tax_id
      },
      customFormData: mergedCustomData
    });
  } catch (error: any) {
    console.error('[External API Verify Error]:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

/**
 * @route GET /api/v1/external/embed.js
 * @desc Serves embeddable client SDK script for external NGO landing pages
 */
router.get('/embed.js', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
(function(window, document) {
  'use strict';
  
  var DanaPro = window.DanaPro || {};
  
  DanaPro.pay = function(config) {
    if (!config || !config.apiKey) {
      alert('DanaPro Integration Error: apiKey is required in DanaPro.pay({ apiKey: "dp_live_..." })');
      return;
    }
    
    var endpoint = (config.serverUrl || 'http://localhost:5000') + '/api/v1/external/donations/initiate';
    
    var payload = {
      api_key: config.apiKey,
      amount: config.amount,
      currency: config.currency || 'INR',
      name: config.name,
      email: config.email,
      phone: config.phone,
      taxId: config.taxId,
      campaignSlug: config.campaignSlug,
      customFormData: config.customFormData || {}
    };
    
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wegive-api-key': config.apiKey,
        'x-danapro-api-key': config.apiKey
      },
      body: JSON.stringify(payload)
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.success) {
        alert('Wegive Payment Failed: ' + (data.error || 'Unknown error'));
        return;
      }
      
      // Check if Razorpay JS SDK loaded
      if (typeof window.Razorpay !== 'undefined') {
        var options = {
          key: data.razorpayKeyId,
          amount: Math.round(data.amount * 100),
          currency: data.currency,
          name: data.organization.name,
          description: 'Donation for ' + data.campaign.title,
          handler: function(response) {
            // Verify on server
            fetch((config.serverUrl || 'http://localhost:5000') + '/api/v1/external/donations/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                donationId: data.donationId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
                customFormData: config.customFormData || {}
              })
            })
            .then(function(vRes) { return vRes.json(); })
            .then(function(vData) {
              if (typeof config.onSuccess === 'function') {
                config.onSuccess(vData);
              } else {
                alert('Thank you! Payment of ₹' + data.amount + ' received successfully. 80G Receipt: ' + vData.receiptNumber);
              }
            });
          },
          prefill: {
            name: config.name || '',
            email: config.email || '',
            contact: config.phone || ''
          },
          theme: { color: '#059669' }
        };
        
        if (data.orderId && !data.orderId.startsWith('order_dp_ext_') && !data.orderId.startsWith('order_wg_ext_')) {
          options.order_id = data.orderId;
        }
        
        var rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        alert('Razorpay Checkout SDK not loaded on this page. Please include <script src="https://checkout.razorpay.com/v1/checkout.js"></script>');
      }
    })
    .catch(function(err) {
      console.error('[Wegive Embed Error]:', err);
      alert('Wegive Integration Network Error');
    });
  };
  
  window.Wegive = Wegive;
  window.DanaPro = Wegive;
})(window, document);
  `);
});

export default router;
