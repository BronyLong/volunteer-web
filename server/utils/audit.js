import { pool } from "../db.js";

function getClientIp(req) {
  const forwarded = req?.headers?.["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return req?.ip || req?.socket?.remoteAddress || null;
}

export async function writeAuditLog({
  userId = null,
  userRole = null,
  action,
  entityType,
  entityId = null,
  req = null,
  status = "success",
  details = {},
  db = pool,
}) {
  if (!action || !entityType) {
    return;
  }

  try {
    await db.query(
      `
      INSERT INTO audit_logs (
        user_id,
        user_role,
        action,
        entity_type,
        entity_id,
        method,
        route,
        ip_address,
        user_agent,
        status,
        details
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      `,
      [
        userId,
        userRole,
        action,
        entityType,
        entityId !== null && entityId !== undefined ? String(entityId) : null,
        req?.method || null,
        req?.originalUrl || null,
        req ? getClientIp(req) : null,
        req?.headers?.["user-agent"] || null,
        status,
        JSON.stringify(details || {}),
      ]
    );
  } catch (error) {
    console.error("Audit log write error:", error);
  }
}