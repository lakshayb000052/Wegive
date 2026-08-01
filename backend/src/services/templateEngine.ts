import pool from '../config/db';

export interface WhitelistVariables {
  donor_name?: string;
  donor_email?: string;
  donor_phone?: string;
  donor_tax_id?: string;
  donor_country?: string;
  donation_amount?: string | number;
  donation_currency?: string;
  donation_date?: string;
  transaction_id?: string;
  payment_method?: string;
  campaign_title?: string;
  ngo_name?: string;
  ngo_urn?: string;
  ngo_signatory?: string;
  ngo_country?: string;
  receipt_url?: string;
}

export const WHITELIST_VAR_DESCRIPTIONS: Record<string, string> = {
  donor_name: "Donor's Full Name (e.g. Lakshay Bansal)",
  donor_email: "Donor's Email Address (e.g. lakshay@gmail.com)",
  donor_phone: "Donor's Phone / WhatsApp Number (e.g. +91 9876543210)",
  donor_tax_id: "Donor's PAN / Tax ID (e.g. ABCDE1234F)",
  donor_country: "Donor's Billing Country (e.g. IN)",
  donation_amount: "Donation Amount (e.g. 5,000)",
  donation_currency: "Currency Code (e.g. INR, USD)",
  donation_date: "Date of Contribution (e.g. 2026-07-26)",
  transaction_id: "Payment Gateway Transaction ID (e.g. pay_Nabc123)",
  payment_method: "Payment Method Rail (e.g. UPI, CARD)",
  campaign_title: "Campaign Title (e.g. Clean Water Initiative)",
  ngo_name: "NGO Organization Name (e.g. WaterAid India)",
  ngo_urn: "80G URN Approval Registration Number (e.g. AAATD0192K20261)",
  ngo_signatory: "Authorized Digital Signatory Officer (e.g. Country Director)",
  ngo_country: "NGO Registration Country (e.g. IN)",
  receipt_url: "Instant PDF Receipt Download URL Link"
};

/**
 * Replace all {{variable_name}} tokens in content string with actual database values.
 */
export function renderTemplateContent(templateContent: string, vars: WhitelistVariables): string {
  if (!templateContent) return '';

  return templateContent.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, tokenName) => {
    const key = tokenName.trim() as keyof WhitelistVariables;
    if (vars[key] !== undefined && vars[key] !== null) {
      return String(vars[key]);
    }
    return match; // Return original {{token}} if missing in map
  });
}

/**
 * Resolve active template for an NGO by type ('80g_receipt' | 'whatsapp_message' | 'email_thankyou')
 * Checks NGO specific template -> Master System Default -> Built-in Fallback
 */
export async function getResolvedTemplate(
  organizationId: string | null | undefined,
  type: '80g_receipt' | 'whatsapp_message' | 'email_thankyou'
): Promise<{ content: string; subject?: string; name: string; source: 'ngo' | 'master_default' | 'fallback' }> {
  try {
    // 1. Check custom NGO template
    if (organizationId) {
      const ngoRes = await pool.query(
        'SELECT name, subject, content FROM templates WHERE organization_id = $1 AND type = $2 ORDER BY updated_at DESC LIMIT 1',
        [organizationId, type]
      );
      if (ngoRes.rows.length > 0) {
        return {
          name: ngoRes.rows[0].name,
          subject: ngoRes.rows[0].subject,
          content: ngoRes.rows[0].content,
          source: 'ngo'
        };
      }
    }

    // 2. Check Master System Default
    const defaultRes = await pool.query(
      'SELECT name, subject, content FROM templates WHERE (organization_id IS NULL OR is_default = TRUE) AND type = $1 ORDER BY is_default DESC, updated_at DESC LIMIT 1',
      [type]
    );
    if (defaultRes.rows.length > 0) {
      return {
        name: defaultRes.rows[0].name,
        subject: defaultRes.rows[0].subject,
        content: defaultRes.rows[0].content,
        source: 'master_default'
      };
    }
  } catch (error) {
    console.error(`[TemplateEngine] Error loading template for ${type}:`, error);
  }

  // 3. Fallback Built-in strings
  if (type === 'whatsapp_message') {
    return {
      name: 'Default WhatsApp Alert',
      content: 'Dear {{donor_name}},\n\nThank you for contributing {{donation_currency}} {{donation_amount}} to "{{campaign_title}}" by {{ngo_name}}.\n\nTransaction: {{transaction_id}}\nDownload 80G Receipt: {{receipt_url}}',
      source: 'fallback'
    };
  } else if (type === 'email_thankyou') {
    return {
      name: 'Default Email Thank-You',
      subject: 'Thank you for supporting {{ngo_name}}!',
      content: '<div style="font-family: sans-serif; padding: 20px;"><h2>Thank you {{donor_name}}!</h2><p>Your contribution of {{donation_currency}} {{donation_amount}} for "{{campaign_title}}" was successful.</p><p><a href="{{receipt_url}}">Download 80G Receipt</a></p></div>',
      source: 'fallback'
    };
  } else {
    return {
      name: 'Default 80G Certificate',
      subject: '80G Tax Exemption Certificate',
      content: '<div style="font-family: sans-serif; padding: 20px;"><h1>80G RECEIPT</h1><p>NGO: {{ngo_name}} (URN: {{ngo_urn}})</p><p>Donor: {{donor_name}} (PAN: {{donor_tax_id}})</p><p>Amount: {{donation_currency}} {{donation_amount}}</p></div>',
      source: 'fallback'
    };
  }
}
