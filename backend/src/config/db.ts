import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:Lakshay%40123@localhost:5432/DanaPro?schema=public';
const isProduction = process.env.NODE_ENV === 'production' || connectionString.includes('render.com') || connectionString.includes('sslmode=require');

const pool = new Pool({
  connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Verify connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('==========================================');
    console.error(' ERROR CONNECTING TO POSTGRESQL DATABASE');
    console.error(' Message:', err.message);
    console.error(' Make sure pgAdmin / Postgres server is running and the "DanaPro" DB exists.');
    console.error('==========================================');
    return;
  }
  
  client?.query('SELECT NOW()', async (queryErr, res) => {
    release();
    if (queryErr) {
      return console.error('Database query test failed:', queryErr.stack);
    }
    console.log(' Database status: Connected to "DanaPro" successfully.');

    // Auto-create templates table if missing
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL,
            name VARCHAR(255) NOT NULL,
            subject VARCHAR(255),
            content TEXT NOT NULL,
            is_default BOOLEAN DEFAULT FALSE,
            created_by VARCHAR(50) DEFAULT 'system',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'approved';
        ALTER TABLE donations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE organizations ADD COLUMN IF NOT EXISTS verified_sender_email VARCHAR(255);
        UPDATE campaigns SET approval_status = 'approved', is_active = true WHERE approval_status IS NULL OR approval_status = 'pending';
        UPDATE organizations SET permissions = jsonb_set(COALESCE(permissions, '{}'::jsonb), '{platform_fee_percent}', '0.0') WHERE permissions->>'platform_fee_percent' IS NULL OR permissions->>'platform_fee_percent' = '2' OR permissions->>'platform_fee_percent' = '2.0';
      `);
      console.log(' Auto-verified PostgreSQL "templates", "campaigns", "donations", & "organizations" table structures.');

      // Check if default templates exist
      const countRes = await pool.query('SELECT COUNT(*) FROM templates');
      if (Number(countRes.rows[0].count) === 0) {
        console.log(' Seeding initial Master System Templates...');
        await pool.query(`
          INSERT INTO templates (type, name, subject, content, is_default, created_by)
          VALUES 
          (
            '80g_receipt', 
            'Default 80G Statutory Certificate Layout', 
            'Official 80G Tax Exemption Certificate', 
            '<div style="font-family: sans-serif; padding: 24px; color: #1E293B;">\n  <h1 style="color: #0D9488; text-align: center;">DONATION RECEIPT & CERTIFICATE</h1>\n  <hr style="border: none; border-top: 2px solid #0D9488; margin: 16px 0;" />\n  <div style="display: flex; justify-content: space-between;">\n    <div>\n      <h3>RECIPIENT ORGANISATION</h3>\n      <p><strong>{{ngo_name}}</strong></p>\n      <p>URN: URN-{{ngo_urn}}</p>\n      <p>Signatory: {{ngo_signatory}}</p>\n    </div>\n    <div>\n      <h3>DONOR DETAILS</h3>\n      <p>Name: <strong>{{donor_name}}</strong></p>\n      <p>Email: {{donor_email}}</p>\n      <p>PAN: {{donor_tax_id}}</p>\n    </div>\n  </div>\n  <div style="margin-top: 20px; padding: 16px; background-color: #F8FAFC; border-radius: 8px;">\n    <p>Campaign: <strong>{{campaign_title}}</strong></p>\n    <p>Amount Donated: <strong style="font-size: 1.2rem; color: #059669;">{{donation_currency}} {{donation_amount}}</strong></p>\n    <p>Date: {{donation_date}}</p>\n    <p>Transaction ID: <code>{{transaction_id}}</code></p>\n  </div>\n  <p style="font-size: 0.8rem; color: #64748B; margin-top: 24px; text-align: center;">\n    Statutory Declaration: Donations qualify for 80G tax benefits under Income Tax Act, 1961.\n  </p>\n</div>', 
            TRUE, 
            'system'
          ),
          (
            'whatsapp_message', 
            'Default WhatsApp Donation Success Alert', 
            'WhatsApp Donation Alert', 
            'Dear {{donor_name}},\n\nThank you for your generous contribution of {{donation_currency}} {{donation_amount}} to support "{{campaign_title}}" by {{ngo_name}}.\n\nTransaction Ref: {{transaction_id}}\nPAN / Tax ID: {{donor_tax_id}}\n\nYour 80G Tax Exemption Receipt can be downloaded here: {{receipt_url}}\n\nWith gratitude,\n{{ngo_name}}', 
            TRUE, 
            'system'
          ),
          (
            'email_thankyou', 
            'Default Email Thank-You Notification', 
            'Thank you for your contribution to {{ngo_name}}!', 
            '<div style="font-family: Arial, sans-serif; padding: 24px; max-width: 600px; margin: auto; border: 1px solid #E2E8F0; border-radius: 12px; color: #0F172A;">\n  <h2 style="color: #2563EB; margin-top: 0;">Thank You for Your Generous Contribution!</h2>\n  <p>Dear <strong>{{donor_name}}</strong>,</p>\n  <p>We gratefully acknowledge your contribution of <strong>{{donation_currency}} {{donation_amount}}</strong> in support of <strong>"{{campaign_title}}"</strong> organized by <strong>{{ngo_name}}</strong>.</p>\n  <div style="background: #F1F5F9; padding: 16px; border-radius: 8px; margin: 16px 0; font-size: 0.9rem;">\n    <div><strong>Transaction Reference:</strong> <code>{{transaction_id}}</code></div>\n    <div><strong>Date of Payment:</strong> {{donation_date}}</div>\n    <div><strong>Tax Identification (PAN):</strong> {{donor_tax_id}}</div>\n  </div>\n  <p>Your official tax exemption receipt is ready for download:</p>\n  <p style="text-align: center; margin: 20px 0;">\n    <a href="{{receipt_url}}" style="background: #2563EB; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">📥 Download 80G PDF Receipt</a>\n  </p>\n  <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />\n  <p style="font-size: 0.78rem; color: #64748B; text-align: center;">This notification was dispatched automatically by DanaPro on behalf of {{ngo_name}} (80G URN: {{ngo_urn}}).</p>\n</div>', 
            TRUE, 
            'system'
          );
        `);
      }
    } catch (e: any) {
      console.error('Failed to auto-verify templates table:', e.message);
    }
  });
});

export default pool;
