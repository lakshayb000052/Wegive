import pool from './config/db';

async function fixPendingDonations() {
  try {
    const res = await pool.query("UPDATE donations SET status = 'completed' WHERE status = 'pending'");
    console.log(`Successfully marked ${res.rowCount} donations as completed.`);
    process.exit(0);
  } catch (err) {
    console.error('Error updating donations:', err);
    process.exit(1);
  }
}

fixPendingDonations();
