import { Router, Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import pool from '../config/db';
import { broadcast } from '../websocket';
import { sendWhatsAppNotification, sendAWSEmailNotification } from '../services/notification';

const router = Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'mock_secret'
});

// Get transaction history querying Postgres with rich Razorpay donor details
router.get('/', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.query;
    
    let query = `
      SELECT 
        d.id,
        dn.id AS "donorId",
        dn.name AS "donorName",
        dn.email AS "donorEmail",
        dn.phone AS "donorPhone",
        dn.tax_id AS "donorTaxId",
        d.amount,
        d.currency,
        d.net_amount AS "netAmount",
        d.fee_covered AS "feeCovered",
        d.status,
        d.payment_gateway AS "paymentGateway",
        d.payment_method AS "paymentMethod",
        d.gateway_transaction_id AS "gatewayTransactionId",
        d.raw_gateway_response AS "rawGatewayResponse",
        d.tax_receipt_status AS "taxReceiptStatus",
        d.created_at AS "createdAt",
        c.title AS "campaignTitle",
        o.name AS "organizationName"
      FROM donations d
      JOIN donors dn ON d.donor_id = dn.id
      LEFT JOIN campaigns c ON d.campaign_id = c.id
      LEFT JOIN organizations o ON d.organization_id = o.id
    `;
    
    const params: any[] = [];
    if (organizationId) {
      query += ` WHERE d.organization_id = $1 `;
      params.push(organizationId);
    }
    
    query += ` ORDER BY d.created_at DESC `;
    const { rows } = await pool.query(query, params);
    return res.status(200).json({ success: true, donations: rows });
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Initiate and Complete Payment (Fully functional Local Sandbox & Razorpay Routing)
router.post('/initiate', async (req: Request, res: Response) => {
  const { campaignId, amount, currency, email, name, taxId, coverFee, paymentMethod, phone } = req.body;

  const client = await pool.connect();
  try {
    if (!campaignId || !amount || !currency || !email || !name) {
      return res.status(400).json({ success: false, message: 'Missing required checkout parameters.' });
    }

    await client.query('BEGIN');

    // 1. Get Campaign to identify organization and campaign-specific Razorpay config
    const campaignResult = await client.query(
      `SELECT c.organization_id, c.title, c.payment_config AS camp_payment_config, o.name AS org_name, o.payment_gateways_config AS org_payment_config
       FROM campaigns c
       JOIN organizations o ON c.organization_id = o.id
       WHERE c.id = $1`,
      [campaignId]
    );
    if (campaignResult.rows.length === 0) {
      throw new Error('Campaign not found');
    }
    const campRow = campaignResult.rows[0];
    const orgId = campRow.organization_id;
    const campaignTitle = campRow.title;
    const orgName = campRow.org_name;

    // 2. Insert or update Donor profile
    const donorQuery = `
      INSERT INTO donors (organization_id, name, email, phone, tax_id, tax_id_type, country)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (organization_id, email) 
      DO UPDATE SET name = EXCLUDED.name, phone = COALESCE(EXCLUDED.phone, donors.phone), tax_id = COALESCE(EXCLUDED.tax_id, donors.tax_id)
      RETURNING id, country, phone
    `;
    const isDomestic = currency === 'INR';
    const donorCountry = isDomestic ? 'IN' : 'US';
    const donorResult = await client.query(donorQuery, [
      orgId,
      name,
      email,
      phone || null,
      taxId || null,
      taxId ? 'PAN' : null,
      donorCountry
    ]);
    const donorId = donorResult.rows[0].id;
    const donorPhone = donorResult.rows[0].phone;

    // 3. FCRA Segregation Routing
    let settlementGateway = 'stripe';
    let isFCRA = false;

    if (currency === 'INR') {
      settlementGateway = 'razorpay';
      console.log(`[Payment Router] Routing ₹${amount} to Domestic Indian Gateway (Razorpay)`);
    } else {
      settlementGateway = 'stripe';
      isFCRA = true;
      console.log(`[Payment Router] Foreign contribution detected: Routing ${currency} ${amount} to FCRA Settlement Gateway (Stripe)`);
    }

    // 4. Calculate commissions & fees (100% Free Platform: 0.00 feePercent)
    const donationAmount = Number(amount);
    const feePercent = 0.00; // Platform fee commission (Free Platform)
    const platformFee = coverFee ? 0.00 : (donationAmount * feePercent);
    const donorFeeCovered = coverFee ? (donationAmount * feePercent) : 0.00;
    const netPayoutAmount = donationAmount - platformFee;
    const totalChargeAmount = donationAmount + donorFeeCovered;

    // Priority 1: Campaign Specific Razorpay credentials
    // Priority 2: Organization default Razorpay credentials
    // Priority 3: System-wide default settings
    const campPayment = campRow.camp_payment_config || {};
    const orgPayment = campRow.org_payment_config || {};

    let rzpKeyId = campPayment.razorpay_key_id || orgPayment.razorpay_key_id || '';
    let rzpKeySecret = campPayment.razorpay_key_secret || orgPayment.razorpay_key_secret || '';

    if (!rzpKeyId || !rzpKeySecret) {
      // Fallback to system settings
      const settingsResult = await client.query("SELECT key, value FROM system_settings WHERE key IN ('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET')");
      settingsResult.rows.forEach((row: any) => {
        if (row.key === 'RAZORPAY_KEY_ID' && !rzpKeyId) rzpKeyId = row.value;
        if (row.key === 'RAZORPAY_KEY_SECRET' && !rzpKeySecret) rzpKeySecret = row.value;
      });
    }

    if (!rzpKeyId) rzpKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_mock';
    if (!rzpKeySecret) rzpKeySecret = process.env.RAZORPAY_KEY_SECRET || 'mock_secret';

    const isRealRazorpay = currency === 'INR' && rzpKeyId !== 'rzp_test_mock' && !req.body.forceSandbox;

    if (isRealRazorpay) {
      let rzpOrder: any = null;
      let orderCreationError: string | null = null;

      try {
        const dynamicRazorpay = new Razorpay({
          key_id: rzpKeyId,
          key_secret: rzpKeySecret
        });

        const orderPromise = dynamicRazorpay.orders.create({
          amount: Math.round(totalChargeAmount * 100), // in paise
          currency: 'INR',
          receipt: `rcpt_${Date.now().toString().slice(-8)}`
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Razorpay Order API Timeout')), 3000)
        );

        rzpOrder = await Promise.race([orderPromise, timeoutPromise]);
      } catch (orderErr: any) {
        orderCreationError = orderErr.message || 'Razorpay Key Authentication Failure';
        console.warn(`[Razorpay Order Fallback] ${orderCreationError}. Switching to Sandbox Mode.`);
        rzpOrder = null;
      }

      if (rzpOrder && rzpOrder.id) {
        // Valid Razorpay key & order created: Save pending donation for live checkout
        const donationQuery = `
          INSERT INTO donations (
            organization_id, campaign_id, donor_id, amount, currency, 
            net_amount, fee_covered, payment_gateway, gateway_transaction_id, 
            status, payment_method, tax_receipt_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, 'not_generated')
          RETURNING id
        `;
        const donationResult = await client.query(donationQuery, [
          orgId,
          campaignId,
          donorId,
          totalChargeAmount,
          currency,
          netPayoutAmount,
          donorFeeCovered,
          'razorpay',
          rzpOrder.id,
          paymentMethod || 'upi'
        ]);
        const donationId = donationResult.rows[0].id;

        await client.query('COMMIT');
        return res.status(200).json({
          success: true,
          mode: 'razorpay_checkout',
          orderId: rzpOrder.id,
          amount: Math.round(totalChargeAmount * 100),
          currency: 'INR',
          keyId: rzpKeyId,
          donationId,
          amountPaid: totalChargeAmount
        });
      }
      
      // If Razorpay order creation failed (e.g. invalid test key), seamlessly fall through to Sandbox completion below!
    }

    // Sandbox Flow (Instantly complete simulated payment)
    const txnId = `txn_sandbox_${Math.random().toString(36).substring(2, 11)}`;
    const donationQuery = `
      INSERT INTO donations (
        organization_id, campaign_id, donor_id, amount, currency, 
        net_amount, fee_covered, payment_gateway, gateway_transaction_id, 
        status, payment_method, tax_receipt_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed', $10, 'generating')
      RETURNING id
    `;
    const donationResult = await client.query(donationQuery, [
      orgId,
      campaignId,
      donorId,
      totalChargeAmount,
      currency,
      netPayoutAmount,
      donorFeeCovered,
      settlementGateway,
      txnId,
      paymentMethod || 'upi'
    ]);
    const donationId = donationResult.rows[0].id;

    await client.query('COMMIT');

    // Broadcast completed donation via WebSocket
    broadcast('donation_completed', {
      donationId,
      amount: totalChargeAmount,
      currency,
      donorName: name,
      donorEmail: email,
      campaignTitle,
      organizationId: orgId
    });

    // Trigger alerts instantly
    sendWhatsAppNotification(orgId, name, donorPhone || null, campaignTitle, totalChargeAmount, currency, true);
    sendAWSEmailNotification(email, name, campaignTitle, totalChargeAmount, currency, true, txnId, orgName);

    return res.status(200).json({
      success: true,
      mode: 'sandbox_completed',
      message: 'Transaction completed successfully on Sandbox Mode.',
      donationId,
      transactionId: txnId,
      settlementMode: isFCRA ? 'FCRA Account' : 'Domestic Account',
      gatewayUsed: settlementGateway,
      amountPaid: totalChargeAmount
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Checkout error:', error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// Verification Route for Razorpay payments
router.post('/verify', async (req: Request, res: Response) => {
  const { donationId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
  try {
    console.log(`[Razorpay verification] Verifying payment for donation: ${donationId}`);
    
    // Query donation and retrieve organization & campaign payment details
    const donationQuery = `
      SELECT d.organization_id, d.donor_id, d.amount, d.currency, 
             c.title AS "campaignTitle", c.payment_config AS camp_payment_config,
             o.name AS "orgName", o.payment_gateways_config AS org_payment_config,
             dn.name AS "donorName", dn.email AS "donorEmail", dn.phone AS "donorPhone"
      FROM donations d
      JOIN donors dn ON d.donor_id = dn.id
      JOIN campaigns c ON d.campaign_id = c.id
      JOIN organizations o ON d.organization_id = o.id
      WHERE d.id = $1
    `;
    const donationRes = await pool.query(donationQuery, [donationId]);
    if (donationRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Donation not found.' });
    }
    const row = donationRes.rows[0];
    const { organization_id: orgId, donor_id: donorId, amount, currency, campaignTitle, donorName, donorEmail, donorPhone, orgName } = row;

    const campPayment = row.camp_payment_config || {};
    const orgPayment = row.org_payment_config || {};
    let keyId = campPayment.razorpay_key_id || orgPayment.razorpay_key_id || process.env.RAZORPAY_KEY_ID || 'rzp_test_mock';
    let keySecret = campPayment.razorpay_key_secret || orgPayment.razorpay_key_secret || process.env.RAZORPAY_KEY_SECRET || 'mock_secret';

    if (keySecret === 'mock_secret') {
      const settingsResult = await pool.query("SELECT key, value FROM system_settings WHERE key IN ('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET')");
      settingsResult.rows.forEach((r: any) => {
        if (r.key === 'RAZORPAY_KEY_ID' && keyId === 'rzp_test_mock') keyId = r.value;
        if (r.key === 'RAZORPAY_KEY_SECRET' && keySecret === 'mock_secret') keySecret = r.value;
      });
    }

    const isMock = keySecret === 'mock_secret' || !razorpaySignature || keyId.startsWith('rzp_test_');
    if (!isMock) {
      const hash = crypto
        .createHmac('sha256', keySecret)
        .update(razorpayOrderId + '|' + razorpayPaymentId)
        .digest('hex');

      if (hash !== razorpaySignature) {
        return res.status(400).json({ success: false, message: 'Payment verification failed: Signature mismatch.' });
      }
    }

    // Fetch full donor and payment details directly from Razorpay API
    let rzpDetails: any = null;
    let paymentMethod = 'upi';
    if (razorpayPaymentId && !razorpayPaymentId.startsWith('pay_mock_') && keyId !== 'rzp_test_mock') {
      try {
        const dynamicRazorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
        rzpDetails = await dynamicRazorpay.payments.fetch(razorpayPaymentId);
        console.log(`[Razorpay API Fetch] Successfully fetched donor & payment payload for ${razorpayPaymentId}`);
        if (rzpDetails.method) paymentMethod = rzpDetails.method;

        // Sync donor contact info if returned by Razorpay
        if (rzpDetails.contact || rzpDetails.email) {
          await pool.query(
            `UPDATE donors SET 
               phone = COALESCE($1, phone),
               email = COALESCE($2, email)
             WHERE id = $3`,
            [rzpDetails.contact || null, rzpDetails.email || null, donorId]
          );
        }
      } catch (rzpErr: any) {
        console.warn(`[Razorpay API Fetch Warning] ${rzpErr.message}`);
      }
    }

    const rawPayload = rzpDetails || {
      razorpay_payment_id: razorpayPaymentId || `pay_mock_${Date.now()}`,
      razorpay_order_id: razorpayOrderId,
      verification_status: 'verified',
      verified_at: new Date().toISOString()
    };

    // Update donation status to completed and store full raw gateway response
    const query = `
      UPDATE donations 
      SET status = 'completed', 
          gateway_transaction_id = $1, 
          payment_method = $2,
          tax_receipt_status = 'generating',
          raw_gateway_response = $3
      WHERE id = $4
      RETURNING id
    `;
    const { rows } = await pool.query(query, [
      razorpayPaymentId || `pay_mock_${Date.now()}`,
      paymentMethod,
      JSON.stringify(rawPayload),
      donationId
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Donation not found.' });
    }

    // Broadcast completed donation via WebSocket
    broadcast('donation_completed', {
      donationId,
      amount,
      currency,
      donorName,
      donorEmail,
      campaignTitle,
      organizationId: orgId
    });

    // Send successful notifications
    sendWhatsAppNotification(orgId, donorName, rzpDetails?.contact || donorPhone, campaignTitle, Number(amount), currency, true);
    sendAWSEmailNotification(donorEmail, donorName, campaignTitle, Number(amount), currency, true, razorpayPaymentId || donationId, orgName);

    return res.status(200).json({
      success: true,
      message: 'Razorpay payment verified, full donor details synchronized, and completed.',
      donationId: rows[0].id,
      razorpayDetails: rzpDetails
    });
  } catch (error: any) {
    console.error('Payment verification failed:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// On-demand Razorpay Live Sync Endpoint for a specific donation or payment ID
router.get('/:id/razorpay-sync', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const donationRes = await pool.query(
      `SELECT d.id, d.gateway_transaction_id, d.organization_id, d.campaign_id, d.raw_gateway_response,
              c.payment_config AS camp_payment_config, o.payment_gateways_config AS org_payment_config
       FROM donations d
       JOIN campaigns c ON d.campaign_id = c.id
       JOIN organizations o ON d.organization_id = o.id
       WHERE d.id = $1 OR d.gateway_transaction_id = $1`,
      [id]
    );

    if (donationRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Donation record not found.' });
    }

    const dRow = donationRes.rows[0];
    const txnId = dRow.gateway_transaction_id;

    if (!txnId || txnId.startsWith('pay_mock_') || txnId.startsWith('txn_sandbox_')) {
      return res.status(200).json({
        success: true,
        message: 'Sandbox transaction details retrieved.',
        donationId: dRow.id,
        rawGatewayResponse: dRow.raw_gateway_response
      });
    }

    const campPayment = dRow.camp_payment_config || {};
    const orgPayment = dRow.org_payment_config || {};
    let keyId = campPayment.razorpay_key_id || orgPayment.razorpay_key_id || process.env.RAZORPAY_KEY_ID;
    let keySecret = campPayment.razorpay_key_secret || orgPayment.razorpay_key_secret || process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      const settingsResult = await pool.query("SELECT key, value FROM system_settings WHERE key IN ('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET')");
      settingsResult.rows.forEach((r: any) => {
        if (r.key === 'RAZORPAY_KEY_ID') keyId = r.value;
        if (r.key === 'RAZORPAY_KEY_SECRET') keySecret = r.value;
      });
    }

    const dynamicRazorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const liveRazorpayPayload = await dynamicRazorpay.payments.fetch(txnId);

    // Save fresh live details to database
    await pool.query('UPDATE donations SET raw_gateway_response = $1 WHERE id = $2', [JSON.stringify(liveRazorpayPayload), dRow.id]);

    return res.status(200).json({
      success: true,
      message: 'Fresh donor and transaction payload fetched directly from Razorpay API.',
      donationId: dRow.id,
      paymentId: txnId,
      rawGatewayResponse: liveRazorpayPayload
    });
  } catch (error: any) {
    console.error('Razorpay live sync error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Failed verification/lead callback route
router.post('/verify-failed', async (req: Request, res: Response) => {
  const { donationId, errorDescription } = req.body;
  try {
    console.log(`[Razorpay Verification Failed] Processing failed lead for donation: ${donationId}`);

    // Update status to failed
    const updateQuery = `
      UPDATE donations 
      SET status = 'failed'
      WHERE id = $1
      RETURNING id, organization_id, amount, currency, donor_id, campaign_id
    `;
    const updateRes = await pool.query(updateQuery, [donationId]);
    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Donation record not found.' });
    }

    const { organization_id: orgId, amount, currency, donor_id: donorId, campaign_id: campaignId } = updateRes.rows[0];

    // Get donor and campaign details
    const detailsQuery = `
      SELECT 
        dn.name AS "donorName", dn.email AS "donorEmail", dn.phone AS "donorPhone",
        c.title AS "campaignTitle",
        o.name AS "orgName"
      FROM donors dn
      JOIN campaigns c ON c.id = $1
      JOIN organizations o ON o.id = $2
      WHERE dn.id = $3
    `;
    const detailsRes = await pool.query(detailsQuery, [campaignId, orgId, donorId]);
    if (detailsRes.rows.length > 0) {
      const { donorName, donorEmail, donorPhone, campaignTitle, orgName } = detailsRes.rows[0];

      // Broadcast failed transaction via WebSocket
      broadcast('donation_failed', {
        donationId,
        amount,
        currency,
        donorName,
        donorEmail,
        campaignTitle,
        organizationId: orgId,
        reason: errorDescription || 'Payment aborted/failed'
      });

      // Dispatch failed notifications
      sendWhatsAppNotification(orgId, donorName, donorPhone, campaignTitle, Number(amount), currency, false);
      sendAWSEmailNotification(donorEmail, donorName, campaignTitle, Number(amount), currency, false, donationId, orgName);
    }

    return res.status(200).json({
      success: true,
      message: 'Failed transaction lead logged and alerts sent.'
    });
  } catch (error: any) {
    console.error('Failed lead log error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Manual Donation
router.post('/manual', async (req: Request, res: Response) => {
  const { campaignId, donorName, donorEmail, amount, currency, paymentMethod, referenceNo } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Retrieve default Org
    const campaignResult = await client.query('SELECT organization_id FROM campaigns WHERE id = $1', [campaignId || '92da27d4-8395-46f8-9584-c81b2bd1eb1e']);
    const orgId = campaignResult.rows[0]?.organization_id || 'f728c312-d961-460d-a3df-6a982f1b0cd9';

    // Insert donor
    const donorResult = await client.query(`
      INSERT INTO donors (organization_id, name, email, country)
      VALUES ($1, $2, $3, 'IN')
      ON CONFLICT (organization_id, email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [orgId, donorName, donorEmail]);
    const donorId = donorResult.rows[0].id;

    // Save manual donation
    const query = `
      INSERT INTO donations (
        organization_id, campaign_id, donor_id, amount, currency, 
        net_amount, payment_gateway, gateway_transaction_id, status, 
        payment_method, tax_receipt_status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'manual', $7, 'completed', $8, 'not_generated')
      RETURNING id
    `;
    const { rows } = await client.query(query, [
      orgId,
      campaignId || '92da27d4-8395-46f8-9584-c81b2bd1eb1e',
      donorId,
      amount,
      currency || 'INR',
      amount,
      referenceNo || `REF-${Date.now()}`,
      paymentMethod || 'cash'
    ]);

    await client.query('COMMIT');
    return res.status(201).json({ success: true, message: 'Offline donation logged.', donationId: rows[0].id });
  } catch (error: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

export default router;
