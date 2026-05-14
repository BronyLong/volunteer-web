import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { pool } from "../db.js";
import { decryptEmail } from "../utils/personalData.js";

dotenv.config();

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Требуется авторизация" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      `
      SELECT id, email, role, is_active
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [payload.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Пользователь не найден" });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ message: "Аккаунт деактивирован" });
    }

    req.user = {
      id: user.id,
      email: decryptEmail(user.email),
      role: user.role,
      is_active: user.is_active,
    };

    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError" ||
      error.name === "NotBeforeError"
    ) {
      return res.status(401).json({ message: "Недействительный токен" });
    }

    console.error("Auth middleware error:", error);
    return res.status(500).json({ message: "Ошибка проверки авторизации" });
  }
}