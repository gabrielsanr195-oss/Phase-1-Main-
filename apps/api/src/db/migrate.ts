import 'dotenv/config';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { Pool } from 'pg';

async function migrate() {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  const client = await pool.connect();

  try {
    // Ensure tracking table exists before we do anything else
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL      PRIMARY KEY,
        name       TEXT        NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = join(__dirname, 'migrations');
    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const { rows } = await client.query<{ name: string }>(`SELECT name FROM _migrations`);
    const applied = new Set(rows.map((r) => r.name));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  skip   ${file}`);
        continue;
      }

      const sql = await readFile(join(migrationsDir, file), 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(`INSERT INTO _migrations (name) VALUES ($1)`, [file]);
        await client.query('COMMIT');
        console.log(`  apply  ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  FAIL   ${file}`);
        throw err;
      }
    }

    console.log('✓ Migrations complete');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
