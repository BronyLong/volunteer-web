import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { pool } from "../db.js";
import { writeAuditLog } from "../utils/audit.js";
import { sendMail } from "../utils/email.js";
import { ensureNotificationSettings } from "../utils/notifications.js";

dotenv.config();

const router = Router();
const REGISTRATION_CONFIRMATION_TOKEN_TTL_HOURS = 24;
const PASSWORD_RESET_TOKEN_TTL_HOURS = 1;

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

function getClientUrl() {
  return String(process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
}

function createPlainToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function getTokenExpiresAt(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function buildRegistrationConfirmationEmail({ link }) {
  return {
    subject: "Рука помощи: подтвердите регистрацию",
    text: `Здравствуйте!\n\nДля завершения регистрации в системе «Рука помощи» перейдите по ссылке:\n${link}\n\nСсылка действительна 24 часа. Если вы не регистрировались, просто проигнорируйте это письмо.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #222;">
        <h2 style="margin: 0 0 16px;">Подтверждение регистрации</h2>
        <p>Здравствуйте!</p>
        <p>Для завершения регистрации в системе «Рука помощи» нажмите на кнопку ниже.</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="display: inline-block; padding: 12px 18px; border-radius: 10px; background: #2b8f2f; color: #ffffff; text-decoration: none; font-weight: 700;">
            Подтвердить регистрацию
          </a>
        </p>
        <p>Ссылка действительна 24 часа.</p>
        <p style="color: #666;">Если вы не регистрировались, просто проигнорируйте это письмо.</p>
      </div>
    `,
  };
}

function buildPasswordResetEmail({ link }) {
  return {
    subject: "Рука помощи: восстановление доступа",
    text: `Здравствуйте!\n\nДля восстановления доступа к аккаунту перейдите по ссылке:\n${link}\n\nСсылка действительна 1 час. Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #222;">
        <h2 style="margin: 0 0 16px;">Восстановление доступа</h2>
        <p>Здравствуйте!</p>
        <p>Для восстановления доступа к аккаунту нажмите на кнопку ниже.</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="display: inline-block; padding: 12px 18px; border-radius: 10px; background: #2b8f2f; color: #ffffff; text-decoration: none; font-weight: 700;">
            Восстановить доступ
          </a>
        </p>
        <p>Ссылка действительна 1 час.</p>
        <p style="color: #666;">Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо.</p>
      </div>
    `,
  };
}

async function createAuthToken({ userId, purpose, ttlHours, db = pool }) {
  const plainToken = createPlainToken();
  const tokenHash = hashToken(plainToken);
  const expiresAt = getTokenExpiresAt(ttlHours);

  await db.query(
    `
    INSERT INTO auth_email_tokens (user_id, token_hash, purpose, expires_at)
    VALUES ($1, $2, $3, $4)
    `,
    [userId, tokenHash, purpose, expiresAt]
  );

  return plainToken;
}

router.post("/register", async (req, res) => {
  let { firstName, lastName, middleName, gender, email, password } = req.body;

  firstName = firstName ? String(firstName).trim() : "";
  lastName = lastName ? String(lastName).trim() : "";
  middleName = middleName ? String(middleName).trim() : "";
  gender = gender ? String(gender).trim() : "";
  email = email ? String(email).trim().toLowerCase() : "";
  password = password ? String(password) : "";

  if (!firstName || !lastName || !gender || !email || !password) {
    return res.status(400).json({ message: "Заполни все обязательные поля" });
  }

  if (!["male", "female"].includes(gender)) {
    return res.status(400).json({ message: "Выберите корректное значение пола" });
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
  let confirmationToken = null;
  let user = null;

  try {
    await client.query("BEGIN");

    const existingUser = await client.query(
      `
      SELECT id, email, role, is_active, email_verified
      FROM users
      WHERE LOWER(email) = LOWER($1)
      `,
      [email]
    );

    const hashedPassword = await bcrypt.hash(password, 10);

    if (existingUser.rows.length > 0) {
      user = existingUser.rows[0];

      if (user.email_verified) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          message: "Пользователь с таким email уже существует",
        });
      }

      await client.query(
        `
        UPDATE users
        SET password = $1,
            role = 'volunteer',
            is_active = TRUE,
            email_verified = FALSE
        WHERE id = $2
        `,
        [hashedPassword, user.id]
      );

      await client.query(
        `
        INSERT INTO profiles (user_id, first_name, last_name, middle_name, gender)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO UPDATE
        SET first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            middle_name = EXCLUDED.middle_name,
            gender = EXCLUDED.gender
        `,
        [user.id, firstName, lastName, middleName, gender]
      );

      await client.query(
        `
        UPDATE auth_email_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
          AND purpose = 'registration_confirmation'
          AND used_at IS NULL
        `,
        [user.id]
      );
    } else {
      const userResult = await client.query(
        `
        INSERT INTO users (email, password, role, is_active, email_verified)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, role, is_active, email_verified, created_at
        `,
        [email, hashedPassword, "volunteer", true, false]
      );

      user = userResult.rows[0];

      await client.query(
        `
        INSERT INTO profiles (user_id, first_name, last_name, middle_name, gender)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [user.id, firstName, lastName, middleName, gender]
      );
    }

    await ensureNotificationSettings(user.id, client);

    confirmationToken = await createAuthToken({
      userId: user.id,
      purpose: "registration_confirmation",
      ttlHours: REGISTRATION_CONFIRMATION_TOKEN_TTL_HOURS,
      db: client,
    });

    await writeAuditLog({
      userId: user.id,
      userRole: user.role,
      action: "register_pending_confirmation",
      entityType: "user",
      entityId: user.id,
      req,
      details: {
        email: user.email,
        first_name: firstName,
        last_name: lastName,
        middle_name: middleName,
        gender,
      },
      db: client,
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Register error:", error);
    return res.status(500).json({ message: "Ошибка сервера при регистрации" });
  } finally {
    client.release();
  }

  const confirmationLink = `${getClientUrl()}/confirm-registration?token=${confirmationToken}`;
  const emailContent = buildRegistrationConfirmationEmail({ link: confirmationLink });

  await sendMail({
    to: email,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
  });

  return res.status(201).json({
    message: "Регистрация почти завершена. Мы отправили письмо со ссылкой для подтверждения аккаунта.",
  });
});

router.post("/confirm-registration", async (req, res) => {
  const token = req.body?.token ? String(req.body.token).trim() : "";

  if (!token) {
    return res.status(400).json({ message: "Токен подтверждения обязателен" });
  }

  const tokenHash = hashToken(token);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tokenResult = await client.query(
      `
      SELECT t.id, t.user_id, u.email, u.role, u.is_active, u.email_verified
      FROM auth_email_tokens t
      JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = $1
        AND t.purpose = 'registration_confirmation'
        AND t.used_at IS NULL
        AND t.expires_at > CURRENT_TIMESTAMP
      FOR UPDATE
      `,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Ссылка подтверждения недействительна или устарела",
      });
    }

    const tokenRow = tokenResult.rows[0];

    await client.query(
      `
      UPDATE users
      SET email_verified = TRUE
      WHERE id = $1
      `,
      [tokenRow.user_id]
    );

    await client.query(
      `
      UPDATE auth_email_tokens
      SET used_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [tokenRow.id]
    );

    await writeAuditLog({
      userId: tokenRow.user_id,
      userRole: tokenRow.role,
      action: "registration_confirmed",
      entityType: "user",
      entityId: tokenRow.user_id,
      req,
      details: {
        email: tokenRow.email,
      },
      db: client,
    });

    await client.query("COMMIT");

    return res.json({
      message: "Регистрация подтверждена. Теперь вы можете войти в аккаунт.",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Confirm registration error:", error);
    return res.status(500).json({ message: "Ошибка сервера при подтверждении регистрации" });
  } finally {
    client.release();
  }
});

router.post("/forgot-password", async (req, res) => {
  let { email } = req.body;
  email = email ? String(email).trim().toLowerCase() : "";

  if (!email) {
    return res.status(400).json({ message: "Email обязателен" });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({
      message: "Введите корректный email, например example@mail.com",
    });
  }

  try {
    const userResult = await pool.query(
      `
      SELECT id, email, role, is_active, email_verified
      FROM users
      WHERE LOWER(email) = LOWER($1)
      `,
      [email]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];

      if (user.is_active && user.email_verified) {
        await pool.query(
          `
          UPDATE auth_email_tokens
          SET used_at = CURRENT_TIMESTAMP
          WHERE user_id = $1
            AND purpose = 'password_reset'
            AND used_at IS NULL
          `,
          [user.id]
        );

        const resetToken = await createAuthToken({
          userId: user.id,
          purpose: "password_reset",
          ttlHours: PASSWORD_RESET_TOKEN_TTL_HOURS,
          db: pool,
        });

        const resetLink = `${getClientUrl()}/reset-password?token=${resetToken}`;
        const emailContent = buildPasswordResetEmail({ link: resetLink });

        await sendMail({
          to: user.email,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
        });

        await writeAuditLog({
          userId: user.id,
          userRole: user.role,
          action: "password_reset_requested",
          entityType: "auth",
          entityId: user.id,
          req,
          details: {
            email: user.email,
          },
        });
      }
    }

    return res.json({
      message: "Если аккаунт с таким email существует, мы отправили письмо со ссылкой для восстановления доступа.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Ошибка сервера при восстановлении доступа" });
  }
});

router.post("/reset-password", async (req, res) => {
  const token = req.body?.token ? String(req.body.token).trim() : "";
  const password = req.body?.password ? String(req.body.password) : "";

  if (!token || !password) {
    return res.status(400).json({ message: "Токен и новый пароль обязательны" });
  }

  if (!validatePassword(password)) {
    return res.status(400).json({
      message:
        "Пароль должен быть не менее 8 символов, содержать заглавные и строчные буквы, цифры, спецсимволы и не содержать пробелов",
    });
  }

  const tokenHash = hashToken(token);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tokenResult = await client.query(
      `
      SELECT t.id, t.user_id, u.email, u.role, u.is_active, u.email_verified
      FROM auth_email_tokens t
      JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = $1
        AND t.purpose = 'password_reset'
        AND t.used_at IS NULL
        AND t.expires_at > CURRENT_TIMESTAMP
      FOR UPDATE
      `,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Ссылка восстановления недействительна или устарела",
      });
    }

    const tokenRow = tokenResult.rows[0];

    if (!tokenRow.is_active) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Аккаунт деактивирован" });
    }

    if (!tokenRow.email_verified) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "Сначала подтвердите регистрацию через email",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await client.query(
      `
      UPDATE users
      SET password = $1
      WHERE id = $2
      `,
      [hashedPassword, tokenRow.user_id]
    );

    await client.query(
      `
      UPDATE auth_email_tokens
      SET used_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
        AND purpose = 'password_reset'
        AND used_at IS NULL
      `,
      [tokenRow.user_id]
    );

    await writeAuditLog({
      userId: tokenRow.user_id,
      userRole: tokenRow.role,
      action: "password_reset_completed",
      entityType: "auth",
      entityId: tokenRow.user_id,
      req,
      details: {
        email: tokenRow.email,
      },
      db: client,
    });

    await client.query("COMMIT");

    return res.json({
      message: "Пароль изменен. Теперь вы можете войти с новым паролем.",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Ошибка сервера при изменении пароля" });
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
      SELECT id, email, password, role, is_active, email_verified
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

    if (!user.email_verified) {
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
          reason: "email_not_verified",
        },
      });

      return res.status(403).json({
        message: "Подтвердите регистрацию через ссылку из письма",
      });
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

    await ensureNotificationSettings(user.id, pool);

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

    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Вход выполнен",
      token: jwtToken,
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
