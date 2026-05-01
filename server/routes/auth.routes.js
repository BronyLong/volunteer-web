import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { pool } from "../db.js";
import { writeAuditLog } from "../utils/audit.js";

dotenv.config();

const router = Router();

function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function validatePassword(password) {
  if (password.length < 8) return false;

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const hasSpaces = /\s/.test(password);

  return hasUpper && hasLower && hasDigit && hasSpecial && !hasSpaces;
}

router.post("/register", async (req, res) => {
  let { firstName, lastName, email, password } = req.body;

  firstName = firstName ? String(firstName).trim() : "";
  lastName = lastName ? String(lastName).trim() : "";
  email = email ? String(email).trim().toLowerCase() : "";
  password = password ? String(password) : "";

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ message: "Заполни все обязательные поля" });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({
      message: "Введите корректный email, например example@mail.com",
    });
  }

  if (!validatePassword(password)) {
    return res.status(400).json({
      message:
        "Пароль должен быть не менее 8 символов, содержать заглавные и строчные буквы, цифры, спецсимволы и не содержать пробелов",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingUser = await client.query(
      `
      SELECT id
      FROM users
      WHERE LOWER(email) = LOWER($1)
      `,
      [email]
    );

    if (existingUser.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "Пользователь с таким email уже существует",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userResult = await client.query(
      `
      INSERT INTO users (email, password, role, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, role, is_active, created_at
      `,
      [email, hashedPassword, "volunteer", true]
    );

    const user = userResult.rows[0];

    await client.query(
      `
      INSERT INTO profiles (user_id, first_name, last_name)
      VALUES ($1, $2, $3)
      `,
      [user.id, firstName, lastName]
    );

    await writeAuditLog({
      userId: user.id,
      userRole: user.role,
      action: "register",
      entityType: "user",
      entityId: user.id,
      req,
      details: {
        email: user.email,
        first_name: firstName,
        last_name: lastName,
      },
      db: client,
    });

    await client.query("COMMIT");

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Регистрация успешна",
      token,
      user,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Register error:", error);
    res.status(500).json({ message: "Ошибка сервера при регистрации" });
  } finally {
    client.release();
  }
});

router.post("/login", async (req, res) => {
  let { email, password } = req.body;

  email = email ? String(email).trim().toLowerCase() : "";
  password = password ? String(password) : "";

  if (!email || !password) {
    return res.status(400).json({ message: "Email и пароль обязательны" });
  }

  try {
    const result = await pool.query(
      `
      SELECT id, email, password, role, is_active
      FROM users
      WHERE LOWER(email) = LOWER($1)
      `,
      [email]
    );

    if (result.rows.length === 0) {
      await writeAuditLog({
        action: "login_failed",
        entityType: "auth",
        req,
        status: "failed",
        details: {
          email,
          reason: "user_not_found",
        },
      });

      return res.status(401).json({ message: "Неверный email или пароль" });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      await writeAuditLog({
        userId: user.id,
        userRole: user.role,
        action: "login_blocked",
        entityType: "auth",
        entityId: user.id,
        req,
        status: "failed",
        details: {
          email: user.email,
          reason: "account_inactive",
        },
      });

      return res.status(403).json({ message: "Аккаунт деактивирован" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      await writeAuditLog({
        userId: user.id,
        userRole: user.role,
        action: "login_failed",
        entityType: "auth",
        entityId: user.id,
        req,
        status: "failed",
        details: {
          email: user.email,
          reason: "invalid_password",
        },
      });

      return res.status(401).json({ message: "Неверный email или пароль" });
    }

    await writeAuditLog({
      userId: user.id,
      userRole: user.role,
      action: "login",
      entityType: "auth",
      entityId: user.id,
      req,
      details: {
        email: user.email,
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Вход выполнен",
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Ошибка сервера при входе" });
  }
});

export default router;