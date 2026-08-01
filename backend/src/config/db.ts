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

    // Auto-create all required database tables if missing
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS superadmins (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS organizations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) UNIQUE NOT NULL,
            api_key VARCHAR(255) UNIQUE DEFAULT ('wg_live_' || md5(random()::text)),
            logo_url VARCHAR(2048),
            tax_id_country VARCHAR(10) NOT NULL,
            primary_currency VARCHAR(3) DEFAULT 'INR',
            tax_compliance_config JSONB DEFAULT '{}'::jsonb,
            payment_gateways_config JSONB DEFAULT '{}'::jsonb,
            whatsapp_meta_config JSONB DEFAULT '{}'::jsonb,
            certificate_80g_config JSONB DEFAULT '{}'::jsonb,
            permissions JSONB DEFAULT '{"can_accept_donations": true, "can_issue_80g_receipts": true, "can_export_data": true, "can_run_ai_analytics": true, "platform_fee_percent": 0.0}'::jsonb,
            status VARCHAR(50) DEFAULT 'active',
            verified_sender_email VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS organization_members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            email VARCHAR(255) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'admin',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(organization_id, email)
        );

        CREATE TABLE IF NOT EXISTS campaigns (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            slug VARCHAR(255) UNIQUE NOT NULL,
            api_key VARCHAR(255) UNIQUE DEFAULT ('wg_live_' || md5(random()::text)),
            landing_page_url VARCHAR(2048),
            form_fields JSONB DEFAULT '[]'::jsonb,
            is_active BOOLEAN DEFAULT TRUE,
            approval_status VARCHAR(50) DEFAULT 'approved',
            payment_config JSONB DEFAULT '{}'::jsonb,
            permissions JSONB DEFAULT '{"allow_anonymous": true, "tax_receipt_enabled": true, "min_donation": 1}'::jsonb,
            goal_amount NUMERIC(12, 2) DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS donors (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(50),
            tax_id VARCHAR(100),
            tax_id_type VARCHAR(50),
            country VARCHAR(10),
            metadata JSONB DEFAULT '{"engagement_score": 0, "tags": []}'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(organization_id, email)
        );

        CREATE TABLE IF NOT EXISTS subscriptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            donor_id UUID NOT NULL REFERENCES donors(id) ON DELETE RESTRICT,
            campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
            amount NUMERIC(12, 2) NOT NULL,
            currency VARCHAR(3) NOT NULL,
            interval VARCHAR(50) NOT NULL,
            status VARCHAR(50) DEFAULT 'active',
            gateway_subscription_id VARCHAR(255) UNIQUE,
            next_billing_date TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS donations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
            donor_id UUID NOT NULL REFERENCES donors(id) ON DELETE RESTRICT,
            subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
            amount NUMERIC(12, 2) NOT NULL,
            currency VARCHAR(3) NOT NULL,
            net_amount NUMERIC(12, 2),
            fee_covered NUMERIC(12, 2) DEFAULT 0.00,
            payment_gateway VARCHAR(50) NOT NULL,
            gateway_transaction_id VARCHAR(255) UNIQUE,
            status VARCHAR(50) DEFAULT 'pending',
            payment_method VARCHAR(50),
            is_anonymous BOOLEAN DEFAULT FALSE,
            tax_receipt_status VARCHAR(50) DEFAULT 'not_generated',
            raw_gateway_response JSONB DEFAULT '{}'::jsonb,
            custom_form_data JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS compliance_receipts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            donation_id UUID UNIQUE NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
            receipt_number VARCHAR(100) UNIQUE NOT NULL,
            tax_regime VARCHAR(50) NOT NULL,
            receipt_pdf_url VARCHAR(2048) NOT NULL,
            transaction_hash CHAR(64) NOT NULL,
            metadata JSONB DEFAULT '{}'::jsonb,
            generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID,
            user_type VARCHAR(50) NOT NULL,
            action VARCHAR(255) NOT NULL,
            details JSONB DEFAULT '{}'::jsonb,
            ip_address VARCHAR(45),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ai_interactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
            session_id VARCHAR(255) NOT NULL,
            user_query TEXT NOT NULL,
            ai_response TEXT NOT NULL,
            tokens_used INTEGER DEFAULT 0,
            cost_usd NUMERIC(10, 6) DEFAULT 0.00,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS system_settings (
            key VARCHAR(255) PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

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
      console.log(' Auto-verified all PostgreSQL table structures.');

      // Check if superadmin exists
      const superRes = await pool.query('SELECT COUNT(*) FROM superadmins');
      if (Number(superRes.rows[0].count) === 0) {
        console.log(' Seeding default Superadmin credentials...');
        const bcrypt = require('bcryptjs');
        const passHash = await bcrypt.hash('Superlucky@123', 10);
        await pool.query(`
          INSERT INTO superadmins (email, password_hash)
          VALUES ('Superlucky@gmail.com', $1)
          ON CONFLICT DO NOTHING
        `, [passHash]);
        console.log(' Superadmin seeded: Superlucky@gmail.com');
      }

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
