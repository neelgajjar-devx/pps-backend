import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Running database migrations...');
    
    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort to ensure migrations run in order (001, 002, etc.)
    
    await client.query('BEGIN');
    
    for (const file of files) {
      const migrationFile = path.join(migrationsDir, file);
      console.log(`  Running migration: ${file}`);
      const sql = fs.readFileSync(migrationFile, 'utf8');
      await client.query(sql);
    }
    
    await client.query('COMMIT');
    
    console.log(`✅ Migrations completed successfully (${files.length} migration(s) run)`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

runMigrations()
  .then(() => {
    console.log('✅ Database setup complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  });
