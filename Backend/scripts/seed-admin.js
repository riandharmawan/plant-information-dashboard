/**
 * One-off staging bootstrap: ensure user "admin" exists with password admin123.
 * Run after migrations or pg_restore when APP_ENV is not dev:
 *   npm run seed:admin
 *   docker compose ... exec -T pid-api npm run seed:admin
 */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const siteId = 'bekasi'

const client = await pool.connect()
try {
  await client.query('BEGIN')
  const hash = bcrypt.hashSync('admin123', 10)

  const adminRole = await client.query(
    `SELECT id FROM roles WHERE name = 'Administrator' LIMIT 1`,
  )
  if (adminRole.rowCount === 0) {
    throw new Error('Administrator role missing — run npm run seed or restore a dump with roles first.')
  }

  const user = await client.query(
    `INSERT INTO users (username, display_name, password_hash, is_active, deleted_at)
     VALUES ('admin','Administrator',$1,TRUE,NULL)
     ON CONFLICT (username) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, is_active = TRUE, deleted_at = NULL, updated_at = NOW()
     RETURNING id`,
    [hash],
  )

  await client.query(
    `INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [user.rows[0].id, adminRole.rows[0].id],
  )

  const site = await client.query(`SELECT id FROM sites WHERE id = $1 LIMIT 1`, [siteId])
  if (site.rowCount > 0) {
    await client.query(
      `INSERT INTO user_sites (user_id, site_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [user.rows[0].id, siteId],
    )
  }

  await client.query('COMMIT')
  console.log('Admin user ready (username: admin, password: admin123). Change password after first login.')
} catch (error) {
  await client.query('ROLLBACK')
  console.error(error)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
