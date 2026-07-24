import { Router, Request, Response } from 'express';
import pool from '../config/db';

const router = Router();

// 1. Get global stats & metrics for the superadmin dashboard
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const orgCountQuery = 'SELECT COUNT(*) FROM organizations';
    const donorCountQuery = 'SELECT COUNT(*) FROM donors';
    const gmvQuery = "SELECT COALESCE(SUM(amount), 0) AS total FROM donations WHERE status IN ('completed', 'pending')";
    const feeRevenueQuery = "SELECT 0.00 AS total";
    const flaggedQuery = "SELECT COUNT(*) FROM donations WHERE status = 'flagged'";

    const [orgs, donors, gmv, fees, flagged] = await Promise.all([
      pool.query(orgCountQuery),
      pool.query(donorCountQuery),
      pool.query(gmvQuery),
      pool.query(feeRevenueQuery),
      pool.query(flaggedQuery)
    ]);

    return res.status(200).json({
      success: true,
      metrics: {
        totalOrganizations: Number(orgs.rows[0]?.count || 0),
        activeDonors: Number(donors.rows[0]?.count || 0),
        grossVolumeGMV: Number(gmv.rows[0]?.total || 0),
        platformFeeRevenue: Number(fees.rows[0]?.total || 0),
        flaggedTransactions: Number(flagged.rows[0]?.count || 0)
      }
    });
  } catch (error: any) {
    console.error('Superadmin metrics error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Get list of all NGOs including WhatsApp Meta, 80G Certificate, Payment Gateways, and Permissions Configs
router.get('/organizations', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, slug, tax_id_country, primary_currency, status, whatsapp_meta_config, certificate_80g_config, payment_gateways_config, permissions, created_at 
       FROM organizations ORDER BY created_at DESC`
    );
    return res.status(200).json({
      success: true,
      organizations: rows
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 3. CREATE NGO (with permissions and payment gateways config)
router.post('/organizations', async (req: Request, res: Response) => {
  const { name, slug, tax_id_country, primary_currency, status, whatsapp_meta_config, certificate_80g_config, payment_gateways_config, permissions } = req.body;
  try {
    if (!name || !slug || !tax_id_country) {
      return res.status(400).json({ success: false, message: 'Name, Slug, and Tax Country are required.' });
    }
    const defaultPermissions = {
      can_accept_donations: true,
      can_issue_80g_receipts: true,
      can_export_data: true,
      can_run_ai_analytics: true,
      platform_fee_percent: 0.0
    };

    const query = `
      INSERT INTO organizations (name, slug, tax_id_country, primary_currency, status, whatsapp_meta_config, certificate_80g_config, payment_gateways_config, permissions)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, name, slug, status, whatsapp_meta_config, certificate_80g_config, payment_gateways_config, permissions
    `;
    const { rows } = await pool.query(query, [
      name, 
      slug, 
      tax_id_country, 
      primary_currency || 'INR',
      status || 'active',
      JSON.stringify(whatsapp_meta_config || {}),
      JSON.stringify(certificate_80g_config || {}),
      JSON.stringify(payment_gateways_config || {}),
      JSON.stringify(permissions || defaultPermissions)
    ]);
    return res.status(201).json({ success: true, message: 'NGO created successfully!', organization: rows[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 4. UPDATE NGO
router.put('/organizations/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, slug, tax_id_country, primary_currency, status, whatsapp_meta_config, certificate_80g_config, payment_gateways_config, permissions } = req.body;
  try {
    const query = `
      UPDATE organizations 
      SET name = $1, slug = $2, tax_id_country = $3, primary_currency = $4, status = $5, whatsapp_meta_config = $6, certificate_80g_config = $7, payment_gateways_config = $8, permissions = $9
      WHERE id = $10
      RETURNING id, name, slug, status, whatsapp_meta_config, certificate_80g_config, payment_gateways_config, permissions
    `;
    const { rows } = await pool.query(query, [
      name, 
      slug, 
      tax_id_country, 
      primary_currency, 
      status, 
      JSON.stringify(whatsapp_meta_config || {}),
      JSON.stringify(certificate_80g_config || {}),
      JSON.stringify(payment_gateways_config || {}),
      JSON.stringify(permissions || {}),
      id
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Organization not found.' });
    }
    return res.status(200).json({ success: true, message: 'NGO updated successfully!', organization: rows[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 4B. PATCH NGO Permissions & Razorpay credentials directly
router.patch('/organizations/:id/permissions', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { permissions, status, payment_gateways_config } = req.body;
  try {
    const { rows: currentRows } = await pool.query('SELECT permissions, payment_gateways_config, status FROM organizations WHERE id = $1', [id]);
    if (currentRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Organization not found.' });
    }

    const currentPerms = currentRows[0].permissions || {};
    const currentGateways = currentRows[0].payment_gateways_config || {};

    const updatedPermissions = { ...currentPerms, ...(permissions || {}) };
    const updatedGateways = { ...currentGateways, ...(payment_gateways_config || {}) };
    const updatedStatus = status || currentRows[0].status;

    const query = `
      UPDATE organizations
      SET permissions = $1, payment_gateways_config = $2, status = $3
      WHERE id = $4
      RETURNING id, name, permissions, payment_gateways_config, status
    `;
    const { rows } = await pool.query(query, [
      JSON.stringify(updatedPermissions),
      JSON.stringify(updatedGateways),
      updatedStatus,
      id
    ]);

    return res.status(200).json({ success: true, message: 'NGO permissions & keys updated!', organization: rows[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 5. DELETE NGO
router.delete('/organizations/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM organizations WHERE id = $1', [id]);
    return res.status(200).json({ success: true, message: 'NGO deleted successfully!' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Get all Campaigns globally (with payment_config, permissions, api_key, and landing_page_url)
router.get('/campaigns', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT c.id, c.title, c.description, c.slug, c.api_key, c.landing_page_url, c.is_active, c.goal_amount, c.payment_config, c.permissions, c.form_fields, o.name AS "orgName", c.organization_id
      FROM campaigns c
      JOIN organizations o ON c.organization_id = o.id
      ORDER BY c.created_at DESC
    `;
    const { rows } = await pool.query(query);
    return res.status(200).json({ success: true, campaigns: rows });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 7. CREATE Campaign globally (with custom Razorpay credentials, landing_page_url & campaign permissions)
router.post('/campaigns', async (req: Request, res: Response) => {
  const { organizationId, title, description, slug, landing_page_url, goal_amount, is_active, payment_config, permissions, form_fields } = req.body;
  try {
    if (!organizationId || !title || !slug) {
      return res.status(400).json({ success: false, message: 'Assigning a target NGO Organization, Campaign Title, and Slug are strictly required.' });
    }

    // Verify target NGO exists in the database
    const orgCheck = await pool.query('SELECT id, name FROM organizations WHERE id = $1', [organizationId]);
    if (orgCheck.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Specified NGO Organization does not exist in the database. Please create or assign an existing NGO first.' });
    }

    const generatedApiKey = `dp_live_${slug.replace(/[^a-z0-9]/gi, '')}_${Date.now().toString().slice(-6)}`;
    const query = `
      INSERT INTO campaigns (organization_id, title, description, slug, api_key, landing_page_url, goal_amount, is_active, payment_config, permissions, form_fields)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, title, slug, api_key, landing_page_url, is_active, goal_amount, payment_config, permissions
    `;
    const { rows } = await pool.query(query, [
      organizationId,
      title,
      description || '',
      slug,
      generatedApiKey,
      landing_page_url || null,
      goal_amount || 0,
      is_active !== undefined ? is_active : true,
      JSON.stringify(payment_config || {}),
      JSON.stringify(permissions || { allow_anonymous: true, tax_receipt_enabled: true }),
      JSON.stringify(form_fields || [])
    ]);
    return res.status(201).json({ success: true, message: 'Campaign created successfully with DanaPro API Key!', campaign: rows[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 8. UPDATE Campaign globally (including campaign-specific Razorpay keys, landing_page_url & permissions)
router.put('/campaigns/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description, slug, landing_page_url, is_active, goal_amount, payment_config, permissions } = req.body;
  try {
    const query = `
      UPDATE campaigns 
      SET title = $1, description = $2, slug = $3, landing_page_url = $4, is_active = $5, goal_amount = $6, payment_config = $7, permissions = $8
      WHERE id = $9
      RETURNING id, title, slug, api_key, landing_page_url, is_active, goal_amount, payment_config, permissions
    `;
    const { rows } = await pool.query(query, [
      title,
      description,
      slug,
      landing_page_url || null,
      is_active,
      goal_amount || 0,
      JSON.stringify(payment_config || {}),
      JSON.stringify(permissions || {}),
      id
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }
    return res.status(200).json({ success: true, message: 'Campaign updated successfully!', campaign: rows[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 8A-1. Auto-provision DanaPro Admin Managed Razorpay Gateway Key for Organization
router.post('/organizations/:id/provision-key', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { rows: orgRows } = await pool.query('SELECT slug, payment_gateways_config FROM organizations WHERE id = $1', [id]);
    if (orgRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Organization not found.' });
    }

    const org = orgRows[0];
    const generatedKeyId = `rzp_test_${org.slug.replace(/[^a-z0-9]/gi, '').slice(0, 8)}_${Date.now().toString().slice(-6)}`;
    const generatedKeySecret = `dp_sec_${Math.random().toString(36).slice(2, 12)}`;

    const updatedConfig = {
      ...(org.payment_gateways_config || {}),
      razorpay_key_id: generatedKeyId,
      razorpay_key_secret: generatedKeySecret,
      provisioned_by: 'danapro_superadmin',
      provisioned_at: new Date().toISOString()
    };

    await pool.query('UPDATE organizations SET payment_gateways_config = $1 WHERE id = $2', [JSON.stringify(updatedConfig), id]);

    return res.status(200).json({
      success: true,
      message: 'DanaPro Admin Managed Razorpay Key provisioned successfully!',
      keyId: generatedKeyId,
      keySecret: generatedKeySecret
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 8A-2. Auto-provision DanaPro Admin Managed Sub-Key for Campaign
router.post('/campaigns/:id/provision-key', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { rows: campRows } = await pool.query('SELECT slug, payment_config FROM campaigns WHERE id = $1', [id]);
    if (campRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }

    const camp = campRows[0];
    const generatedKeyId = `rzp_test_${camp.slug.replace(/[^a-z0-9]/gi, '').slice(0, 8)}_${Date.now().toString().slice(-6)}`;
    const generatedKeySecret = `dp_sec_${Math.random().toString(36).slice(2, 12)}`;

    const updatedConfig = {
      ...(camp.payment_config || {}),
      razorpay_key_id: generatedKeyId,
      razorpay_key_secret: generatedKeySecret,
      provisioned_by: 'danapro_superadmin',
      provisioned_at: new Date().toISOString()
    };

    await pool.query('UPDATE campaigns SET payment_config = $1 WHERE id = $2', [JSON.stringify(updatedConfig), id]);

    return res.status(200).json({
      success: true,
      message: 'DanaPro Admin Managed Campaign Sub-Key provisioned successfully!',
      keyId: generatedKeyId,
      keySecret: generatedKeySecret
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 8B. Money & Payout Breakdown (Full Financial Monitor for Superadmin)
router.get('/breakdown', async (req: Request, res: Response) => {
  try {
    // Overall money summary
    const overallQuery = `
      SELECT 
        COALESCE(COUNT(*), 0) AS total_donations,
        COALESCE(SUM(amount), 0) AS gross_gmv,
        COALESCE(SUM(COALESCE(fee_covered, 0)), 0) AS total_donor_fee_covered,
        0.00 AS total_platform_fee,
        COALESCE(SUM(amount), 0) AS total_ngo_net_payout
      FROM donations
      WHERE status IN ('completed', 'pending')
    `;

    // Breakdown per NGO
    const ngoBreakdownQuery = `
      SELECT 
        o.id AS organization_id,
        o.name AS organization_name,
        o.primary_currency,
        o.status,
        o.payment_gateways_config->>'razorpay_key_id' AS org_razorpay_key,
        COALESCE(COUNT(DISTINCT c.id), 0) AS campaign_count,
        COALESCE(COUNT(DISTINCT d.id), 0) AS donation_count,
        COALESCE(SUM(d.amount), 0) AS gross_amount,
        COALESCE(SUM(COALESCE(d.fee_covered, 0)), 0) AS fee_covered,
        0.00 AS platform_fee,
        COALESCE(SUM(d.amount), 0) AS net_ngo_payout
      FROM organizations o
      LEFT JOIN campaigns c ON c.organization_id = o.id
      LEFT JOIN donations d ON d.organization_id = o.id AND d.status IN ('completed', 'pending')
      GROUP BY o.id, o.name, o.primary_currency, o.status, o.payment_gateways_config
      ORDER BY gross_amount DESC
    `;

    // Breakdown per Campaign
    const campaignBreakdownQuery = `
      SELECT 
        c.id AS campaign_id,
        c.title AS campaign_title,
        c.slug AS campaign_slug,
        c.is_active,
        c.payment_config->>'razorpay_key_id' AS campaign_razorpay_key,
        o.id AS organization_id,
        o.name AS organization_name,
        COALESCE(COUNT(d.id), 0) AS donation_count,
        COALESCE(SUM(d.amount), 0) AS gross_amount,
        COALESCE(SUM(COALESCE(d.fee_covered, 0)), 0) AS fee_covered,
        0.00 AS platform_fee,
        COALESCE(SUM(d.amount), 0) AS net_ngo_payout
      FROM campaigns c
      JOIN organizations o ON c.organization_id = o.id
      LEFT JOIN donations d ON d.campaign_id = c.id AND d.status IN ('completed', 'pending')
      GROUP BY c.id, c.title, c.slug, c.is_active, c.payment_config, o.id, o.name
      ORDER BY gross_amount DESC
    `;

    const [overallRes, ngoRes, campaignRes] = await Promise.all([
      pool.query(overallQuery),
      pool.query(ngoBreakdownQuery),
      pool.query(campaignBreakdownQuery)
    ]);

    return res.status(200).json({
      success: true,
      summary: overallRes.rows[0],
      ngoBreakdown: ngoRes.rows,
      campaignBreakdown: campaignRes.rows
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 8C. Real-time PostgreSQL Analytics & Timeline Trends (For Line Chart & Pie Charts)
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    // 1. Time-series daily donation volume over last 14 days for Line Graph
    const timelineQuery = `
      SELECT 
        TO_CHAR(date_series.day, 'Mon DD') as label,
        COALESCE(SUM(d.amount), 0) as total_amount,
        COALESCE(COUNT(d.id), 0) as donation_count
      FROM (
        SELECT GENERATE_SERIES(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, '1 day'::interval) as day
      ) date_series
      LEFT JOIN donations d ON DATE_TRUNC('day', d.created_at) = date_series.day AND d.status IN ('completed', 'pending')
      GROUP BY date_series.day
      ORDER BY date_series.day ASC
    `;

    // 2. Settlement Gateway breakdown for Donut Chart
    const gatewayQuery = `
      SELECT 
        payment_gateway,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(id) as count
      FROM donations
      GROUP BY payment_gateway
    `;

    // 3. Payment Method distribution for Pie Chart
    const methodQuery = `
      SELECT 
        COALESCE(payment_method, 'upi') as method,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(id) as count
      FROM donations
      GROUP BY payment_method
    `;

    // 4. NGO volume shares for Bar / Pie Chart
    const ngoDistributionQuery = `
      SELECT 
        o.name as ngo_name,
        COALESCE(SUM(d.amount), 0) as total_amount,
        COUNT(d.id) as donation_count
      FROM organizations o
      LEFT JOIN donations d ON d.organization_id = o.id AND d.status IN ('completed', 'pending')
      GROUP BY o.id, o.name
      ORDER BY total_amount DESC
    `;

    const [timeline, gateway, method, ngoDist] = await Promise.all([
      pool.query(timelineQuery),
      pool.query(gatewayQuery),
      pool.query(methodQuery),
      pool.query(ngoDistributionQuery)
    ]);

    return res.status(200).json({
      success: true,
      analytics: {
        timeline: timeline.rows,
        gateways: gateway.rows,
        methods: method.rows,
        ngoDistribution: ngoDist.rows
      }
    });
  } catch (error: any) {
    console.error('Analytics endpoint error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 9. DELETE Campaign globally
router.delete('/campaigns/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM campaigns WHERE id = $1', [id]);
    return res.status(200).json({ success: true, message: 'Campaign deleted successfully!' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 10. DELETE Donation log
router.delete('/donations/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM donations WHERE id = $1', [id]);
    return res.status(200).json({ success: true, message: 'Donation log removed successfully!' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 11. GET System settings (API Keys & Gateways)
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM system_settings');
    const settingsMap: Record<string, string> = {};
    rows.forEach((row: any) => {
      settingsMap[row.key] = row.value;
    });
    return res.status(200).json({ success: true, settings: settingsMap });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 12. POST/PUT Update System settings
router.post('/settings', async (req: Request, res: Response) => {
  const { GEMINI_API_KEY, OPENAI_API_KEY, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const queries = [
      client.query('INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['GEMINI_API_KEY', GEMINI_API_KEY || '']),
      client.query('INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['OPENAI_API_KEY', OPENAI_API_KEY || '']),
      client.query('INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['RAZORPAY_KEY_ID', RAZORPAY_KEY_ID || '']),
      client.query('INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['RAZORPAY_KEY_SECRET', RAZORPAY_KEY_SECRET || ''])
    ];
    await Promise.all(queries);
    await client.query('COMMIT');
    
    // Dynamically update process.env properties so they take effect instantly
    if (GEMINI_API_KEY) process.env.GEMINI_API_KEY = GEMINI_API_KEY;
    if (OPENAI_API_KEY) process.env.OPENAI_API_KEY = OPENAI_API_KEY;
    if (RAZORPAY_KEY_ID) process.env.RAZORPAY_KEY_ID = RAZORPAY_KEY_ID;
    if (RAZORPAY_KEY_SECRET) process.env.RAZORPAY_KEY_SECRET = RAZORPAY_KEY_SECRET;

    return res.status(200).json({ success: true, message: 'Platform configurations updated successfully!' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

export default router;
