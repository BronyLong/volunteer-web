import crypto from "crypto";

const ENCRYPTION_PREFIX = "enc:v1";
const PROFILE_PERSONAL_FIELDS = [
  "first_name",
  "last_name",
  "middle_name",
  "phone",
  "city",
  "avatar_url",
  "bio",
  "social_vk",
  "social_ok",
  "social_max",
];

const AUDIT_SENSITIVE_KEYS = new Set([
  "email",
  "password",
  "password_hash",
  "firstName",
  "lastName",
  "middleName",
  "first_name",
  "last_name",
  "middle_name",
  "phone",
  "city",
  "avatar_url",
  "bio",
  "social_vk",
  "social_ok",
  "social_max",
  "avatar_url",
  "user_agent",
  "ip_address",
]);

function getBase64Key(name) {
  const raw = process.env[name];

  if (!raw) {
    throw new Error(`${name} is not set`);
  }

  const key = Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error(`${name} must be a base64 encoded 32-byte key`);
  }

  return key;
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isEncryptedValue(value) {
  return typeof value === "string" && value.startsWith(`${ENCRYPTION_PREFIX}:`);
}

export function encryptPersonalData(value) {
  if (value === null || value === undefined || value === "") {
    return value;
  }

  const text = String(value);

  if (isEncryptedValue(text)) {
    return text;
  }

  const key = getBase64Key("PERSONAL_DATA_ENCRYPTION_KEY");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTION_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptPersonalData(value) {
  if (value === null || value === undefined || value === "") {
    return value;
  }

  const text = String(value);

  if (!isEncryptedValue(text)) {
    return text;
  }

  const parts = text.split(":");

  if (parts.length !== 5 || parts[0] !== "enc" || parts[1] !== "v1") {
    throw new Error("Invalid encrypted personal data format");
  }

  const key = getBase64Key("PERSONAL_DATA_ENCRYPTION_KEY");
  const iv = Buffer.from(parts[2], "base64url");
  const tag = Buffer.from(parts[3], "base64url");
  const encrypted = Buffer.from(parts[4], "base64url");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString("utf8");
}

export function hashPersonalLookupValue(value) {
  const normalized = normalizeEmail(value);
  const key = getBase64Key("PERSONAL_DATA_HASH_KEY");

  return crypto.createHmac("sha256", key).update(normalized, "utf8").digest("hex");
}

export function encryptEmail(email) {
  return encryptPersonalData(normalizeEmail(email));
}

export function decryptEmail(email) {
  return decryptPersonalData(email);
}

export function decryptUserPersonalFields(user) {
  if (!user) return user;

  return {
    ...user,
    email: decryptEmail(user.email),
  };
}

export function encryptProfilePersonalFields(profile) {
  if (!profile) return profile;

  const encrypted = { ...profile };

  for (const field of PROFILE_PERSONAL_FIELDS) {
    encrypted[field] = encryptPersonalData(encrypted[field]);
  }

  return encrypted;
}

export function decryptProfilePersonalFields(profile) {
  if (!profile) return profile;

  const decrypted = { ...profile };

  for (const field of PROFILE_PERSONAL_FIELDS) {
    decrypted[field] = decryptPersonalData(decrypted[field]);
  }

  return decrypted;
}

export function decryptUserProfileRow(row) {
  if (!row) return row;
  return decryptProfilePersonalFields(decryptUserPersonalFields(row));
}

export function decryptUserProfileRows(rows) {
  return Array.isArray(rows) ? rows.map(decryptUserProfileRow) : [];
}

export function buildEncryptedProfilePayload({
  first_name,
  last_name,
  middle_name,
  phone,
  city,
  avatar_url,
  bio,
  social_vk,
  social_ok,
  social_max,
}) {
  return encryptProfilePersonalFields({
    first_name,
    last_name,
    middle_name,
    phone,
    city,
    avatar_url,
    bio,
    social_vk,
    social_ok,
    social_max,
  });
}

export function sanitizeAuditDetails(value) {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map(sanitizeAuditDetails);
  }

  if (typeof value === "object") {
    const result = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      if (AUDIT_SENSITIVE_KEYS.has(key)) {
        result[key] = "[personal_data_hidden]";
      } else {
        result[key] = sanitizeAuditDetails(nestedValue);
      }
    }

    return result;
  }

  return value;
}
