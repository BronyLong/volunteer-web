import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { pool } from "../db.js";

dotenv.config();

const router = Router();

router.post("/register", async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ message: "Заполни все обязательные поля" });
  }

  try {
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: "Пользователь с таким email уже существует" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userResult = await pool.query(
      `
      INSERT INTO users (email, password, role, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, role, is_active, created_at
      `,
      [email, hashedPassword, "volunteer", true]
    );

    const user = userResult.rows[0];

    await pool.query(
      `
      INSERT INTO profiles (user_id, first_name, last_name)
      VALUES ($1, $2, $3)
      `,
      [user.id, firstName, lastName]
    );

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
    console.error("Register error:", error);
    res.status(500).json({ message: "Ошибка сервера при регистрации" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email и пароль обязательны" });
  }

  try {
    const result = await pool.query(
      "SELECT id, email, password, role, is_active FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Неверный email или пароль" });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ message: "Аккаунт деактивирован" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Неверный email или пароль" });
    }

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