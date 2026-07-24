import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import pool from '../config/db';

export async function sendWhatsAppNotification(
  organizationId: string,
  donorName: string,
  donorPhone: string | null,
  campaignTitle: string,
  amount: number,
  currency: string,
  isSuccess: boolean
) {
  try {
    // 1. Fetch organization meta config
    const orgResult = await pool.query(
      'SELECT name, whatsapp_meta_config FROM organizations WHERE id = $1',
      [organizationId]
    );
    if (orgResult.rows.length === 0) return;

    const { name: orgName, whatsapp_meta_config: waba } = orgResult.rows[0];
    const { waba_id, phone_id, token } = waba || {};

    if (!waba_id || !phone_id || !token) {
      console.log(`[WhatsApp Service] Skipping notification for "${orgName}": Meta API credentials not configured.`);
      return;
    }

    // Format phone number to clean string (only digits, fallback to static test number if none provided)
    let recipientPhone = donorPhone ? donorPhone.replace(/\D/g, '') : '';
    if (!recipientPhone) {
      console.log(`[WhatsApp Service] No valid phone number provided for ${donorName}. Using sandbox fallback...`);
      recipientPhone = '919999999999'; // Default sandbox testing number
    }

    // Add country code if not present (defaulting to 91 for India test clients)
    if (recipientPhone.length === 10) {
      recipientPhone = '91' + recipientPhone;
    }

    const amountText = currency === 'INR' ? `Rs. ${amount}` : `${currency} ${amount}`;
    const statusText = isSuccess ? 'successful' : 'unsuccessful';
    const url = `https://graph.facebook.com/v19.0/${phone_id}/messages`;
    
    // Prepare standard template message payload
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'template',
      template: {
        name: isSuccess ? 'donation_success_alert' : 'donation_failed_alert',
        language: { code: 'en_US' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: donorName },
              { type: 'text', text: amountText },
              { type: 'text', text: campaignTitle },
              { type: 'text', text: orgName }
            ]
          }
        ]
      }
    };

    console.log(`[WhatsApp Service] Sending ${statusText} alert for NGO "${orgName}" to ${recipientPhone} via Meta API...`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const resData = await response.json();
    console.log(`[WhatsApp Service] Meta response:`, resData);

  } catch (error) {
    console.error(`[WhatsApp Service] Error dispatching alert:`, error);
  }
}

export async function sendAWSEmailNotification(
  donorEmail: string,
  donorName: string,
  campaignTitle: string,
  amount: number,
  currency: string,
  isSuccess: boolean,
  transactionId: string,
  orgName: string
) {
  const awsAccessKey = process.env.AWS_ACCESS_KEY_ID;
  const awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const awsRegion = process.env.AWS_REGION || 'us-east-1';
  const senderEmail = process.env.AWS_SENDER_EMAIL || 'notifications@danapro.org';

  const amountText = currency === 'INR' ? `Rs. ${amount}` : `${currency} ${amount}`;
  const subject = isSuccess 
    ? `Thank you for your donation to ${orgName}!` 
    : `Payment attempt incomplete for ${campaignTitle}`;

  const bodyHtml = isSuccess 
    ? `
      <div style="font-family: sans-serif; padding: 20px; color: #1F2937; max-width: 600px; margin: auto; border: 1px solid #E5E7EB; border-radius: 8px;">
        <h2 style="color: #2563EB; border-bottom: 2px solid #3B82F6; padding-bottom: 8px;">Donation Successful!</h2>
        <p>Dear <strong>${donorName}</strong>,</p>
        <p>Thank you for your generous contribution of <strong>${amountText}</strong> to support <strong>"${campaignTitle}"</strong> by <strong>${orgName}</strong>.</p>
        <p>Transaction Reference: <code>${transactionId}</code></p>
        <p>Your compliance tax certificate has been registered. You can download the PDF receipt directly from the NGO portal.</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;"/>
        <p style="font-size: 0.8rem; color: #6B7280; text-align: center;">This transactional notification was dispatched by DanaPro on behalf of ${orgName}.</p>
      </div>
    `
    : `
      <div style="font-family: sans-serif; padding: 20px; color: #1F2937; max-width: 600px; margin: auto; border: 1px solid #E5E7EB; border-radius: 8px;">
        <h2 style="color: #DC2626; border-bottom: 2px solid #EF4444; padding-bottom: 8px;">Donation Attempt Failed / Lead Rejected</h2>
        <p>Dear <strong>${donorName}</strong>,</p>
        <p>We noticed that your attempt to contribute <strong>${amountText}</strong> to the campaign <strong>"${campaignTitle}"</strong> was not completed.</p>
        <p>If you encountered issues, please feel free to retry your payment on our portal. If funds were debited, your bank will automatically process a refund within 3-5 business days.</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;"/>
        <p style="font-size: 0.8rem; color: #6B7280; text-align: center;">This transactional notification was dispatched by DanaPro on behalf of ${orgName}.</p>
      </div>
    `;

  if (!awsAccessKey || !awsSecretKey) {
    console.log(`[AWS SES Service] AWS Credentials not configured in .env. Skipping real SES mail sending.`);
    console.log(`[AWS SES Service] Fallback Logging Send Details:
      To: ${donorEmail}
      Subject: ${subject}
      Amount: ${amountText}
      Success: ${isSuccess}
      Transaction ID: ${transactionId}
      Sender: ${senderEmail}
    `);
    return;
  }

  try {
    const sesClient = new SESClient({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKey,
        secretAccessKey: awsSecretKey
      }
    });

    const command = new SendEmailCommand({
      Destination: { ToAddresses: [donorEmail] },
      Message: {
        Body: {
          Html: { Data: bodyHtml, Charset: 'UTF-8' }
        },
        Subject: { Data: subject, Charset: 'UTF-8' }
      },
      Source: senderEmail
    });

    console.log(`[AWS SES Service] Sending email to ${donorEmail} via SES...`);
    const result = await sesClient.send(command);
    console.log(`[AWS SES Service] SES Success Message ID:`, result.MessageId);
  } catch (error) {
    console.error(`[AWS SES Service] Failed sending email via SES:`, error);
  }
}
