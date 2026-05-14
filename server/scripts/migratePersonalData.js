import dotenv from "dotenv";
import { pool } from "../db.js";
import {
  encryptEmail,
  encryptProfilePersonalFields,
  hashPersonalLookupValue,
  isEncryptedValue,
  normalizeEmail,
  sanitizeAuditDetails,
  encryptPersonalData,
} from "../utils/personalData.js";

dotenv.config();

async function ensureSchema(client) {
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_hash TEXT`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_data_consent BOOLEAN NOT NULL DEFAULT FALSE`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_data_consent_at TIMESTAMP`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_data_consent_version VARCHAR(30)`);
  await client.query(`ALTER TABLE profiles ALTER COLUMN first_name TYPE TEXT`);
  await client.query(`ALTER TABLE profiles ALTER COLUMN last_name TYPE TEXT`);
  await client.query(`ALTER TABLE profiles ALTER COLUMN middle_name TYPE TEXT`);
  await client.query(`ALTER TABLE profiles ALTER COLUMN phone TYPE TEXT`);
  await client.query(`ALTER TABLE profiles ALTER COLUMN city TYPE TEXT`);
  await client.query(`ALTER TABLE profiles ALTER COLUMN avatar_url TYPE TEXT`);
  await client.query(`DROP INDEX IF EXISTS idx_users_email`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash) WHERE email_hash IS NOT NULL`);
}

async function migrateUsers(client) {
  const result = await client.query(`SELECT id, email, email_hash FROM users FOR UPDATE`);

  for (const user of result.rows) {
    if (!user.email) continue;

    const plainEmail = normalizeEmail(user.email);

    if (isEncryptedValue(user.email)) {
      if (!user.email_hash) {
        throw new Error(
          `User ${user.id} already has encrypted email but email_hash is empty. Restore plain email or set hash manually.`
        );
      }
      continue;
    }

    await client.query(
      `
      UPDATE users
      SET email = $1,
          email_hash = $2,
          personal_data_consent = COALESCE(personal_data_consent, TRUE),
          personal_data_consent_at = COALESCE(personal_data_consent_at, CURRENT_TIMESTAMP),
          personal_data_consent_version = COALESCE(personal_data_consent_version, '2026-05-14')
      WHERE id = $3
      `,
      [encryptEmail(plainEmail), hashPersonalLookupValue(plainEmail), user.id]
    );
  }
}

async function migrateProfiles(client) {
  const result = await client.query(
    `
    SELECT user_id, first_name, last_name, middle_name, phone, city, avatar_url, bio, social_vk, social_ok, social_max
    FROM profiles
    FOR UPDATE
    `
  );

  for (const profile of result.rows) {
    const encrypted = encryptProfilePersonalFields(profile);

    await client.query(
      `
      UPDATE profiles
      SET first_name = $1,
          last_name = $2,
          middle_name = $3,
          phone = $4,
          city = $5,
          avatar_url = $6,
          bio = $7,
          social_vk = $8,
          social_ok = $9,
          social_max = $10
      WHERE user_id = $11
      `,
      [
        encrypted.first_name,
        encrypted.last_name,
        encrypted.middle_name,
        encrypted.phone,
        encrypted.city,
        encrypted.avatar_url,
        encrypted.bio,
        encrypted.social_vk,
        encrypted.social_ok,
        encrypted.social_max,
        profile.user_id,
      ]
    );
  }
}


async function migrateAuditLogs(client) {
  const result = await client.query(
    `SELECT id, ip_address, user_agent, details FROM audit_logs FOR UPDATE`
  );

  for (const log of result.rows) {
    await client.query(
      `
      UPDATE audit_logs
      SET ip_address = $1,
          user_agent = $2,
          details = $3::jsonb
      WHERE id = $4
      `,
      [
        encryptPersonalData(log.ip_address),
        encryptPersonalData(log.user_agent),
        JSON.stringify(sanitizeAuditDetails(log.details || {})),
        log.id,
      ]
    );
  }
}

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureSchema(client);
    await migrateUsers(client);
    await migrateProfiles(client);
    await migrateAuditLogs(client);
    await client.query("COMMIT");
    console.log("Personal data encryption migration completed");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Personal data encryption migration failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
