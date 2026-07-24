import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Lakshay%40123@localhost:5432/DanaPro?schema=public',
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
  
  client?.query('SELECT NOW()', (queryErr, res) => {
    release();
    if (queryErr) {
      return console.error('Database query test failed:', queryErr.stack);
    }
    console.log(' Database status: Connected to "DanaPro" successfully.');
  });
});

export default pool;
