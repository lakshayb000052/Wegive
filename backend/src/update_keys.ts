import pool from './config/db';

async function updateCampaignKeys() {
  try {
    await pool.query(`
      UPDATE campaigns 
      SET payment_config = '{"razorpay_key_id": "rzp_test_TGtUm3uP0OFaYN", "razorpay_key_secret": "YourSecret1"}'::jsonb 
      WHERE slug = 'clean-water' OR slug = '/clean-water'
    `);
    await pool.query(`
      UPDATE campaigns 
      SET payment_config = '{"razorpay_key_id": "rzp_test_TGtVgb3KSovD4d", "razorpay_key_secret": "YourSecret2"}'::jsonb 
      WHERE slug = 'winter-kits' OR slug = '/winter-kits'
    `);
    console.log('Successfully updated campaign Razorpay test keys in database!');
    process.exit(0);
  } catch (err) {
    console.error('Error updating keys:', err);
    process.exit(1);
  }
}

updateCampaignKeys();
