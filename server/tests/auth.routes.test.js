import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/testApp.js";

const mocks = vi.hoisted(() => {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };

  return {
    mockClient,
    mockPool: {
      query: vi.fn(),
      connect: vi.fn(() => mockClient),
    },
    mockHash: vi.fn(),
    mockCompare: vi.fn(),
    mockSign: vi.fn(),
    mockWriteAuditLog: vi.fn(),
    mockSendMail: vi.fn(),
    mockEnsureNotificationSettings: vi.fn(),
  };
});

vi.mock("../db.js", () => ({
  pool: mocks.mockPool,
}));

vi.mock("../utils/audit.js", () => ({
  writeAuditLog: mocks.mockWriteAuditLog,
}));

vi.mock("../utils/email.js", () => ({
  sendMail: mocks.mockSendMail,
}));

vi.mock("../utils/notifications.js", () => ({
  ensureNotificationSettings: mocks.mockEnsureNotificationSettings,
}));

vi.mock("../utils/personalData.js", () => ({
  normalizeEmail: (email) => String(email || "").trim().toLowerCase(),
  hashPersonalLookupValue: (email) => `hash:${String(email || "").trim().toLowerCase()}`,
  encryptEmail: (email) => `encrypted:${String(email || "").trim().toLowerCase()}`,
  decryptEmail: (email) => String(email || "").replace(/^encrypted:/, ""),
  encryptPersonalData: (value) => value,
}));

vi.mock("bcrypt", () => ({
  default: {
    hash: mocks.mockHash,
    compare: mocks.mockCompare,
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: mocks.mockSign,
  },
}));

const authRoutes = (await import("../routes/auth.routes.js")).default;
const app = createTestApp("/api/auth", authRoutes);

const validRegisterBody = {
  firstName: " Анна ",
  lastName: " Админ ",
  middleName: " Сергеевна ",
  gender: "female",
  email: " ADMIN@EXAMPLE.COM ",
  password: "Password1!",
  personalDataConsent: true,
};

function resetClient() {
  mocks.mockClient.query.mockReset();
  mocks.mockClient.release.mockReset();
  mocks.mockPool.query.mockReset();
  mocks.mockPool.connect.mockClear();
  mocks.mockWriteAuditLog.mockReset();
  mocks.mockSendMail.mockReset();
  mocks.mockEnsureNotificationSettings.mockReset();
  mocks.mockHash.mockReset();
  mocks.mockCompare.mockReset();
  mocks.mockSign.mockReset();
}

describe("auth.routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    process.env.CLIENT_URL = "http://localhost:5173";
    resetClient();
    mocks.mockHash.mockResolvedValue("hashed-password");
    mocks.mockSendMail.mockResolvedValue(undefined);
    mocks.mockEnsureNotificationSettings.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("registers user, creates profile, writes audit log and sends confirmation email", async () => {
    const user = {
      id: 1,
      email: "encrypted:admin@example.com",
      role: "volunteer",
      is_active: true,
      email_verified: false,
    };

    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [user] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post("/api/auth/register")
      .send(validRegisterBody)
      .expect(201);

    expect(response.body).toEqual({
      message:
        "Регистрация почти завершена. Мы отправили письмо со ссылкой для подтверждения аккаунта.",
    });
    expect(mocks.mockClient.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(mocks.mockHash).toHaveBeenCalledWith("Password1!", 10);
    expect(mocks.mockEnsureNotificationSettings).toHaveBeenCalledWith(1, mocks.mockClient);
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        userRole: "volunteer",
        action: "register_pending_confirmation",
        entityType: "user",
        entityId: 1,
        db: mocks.mockClient,
      })
    );
    expect(mocks.mockClient.query).toHaveBeenCalledWith("COMMIT");
    expect(mocks.mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@example.com",
        subject: "Рука помощи: подтвердите регистрацию",
        text: expect.stringContaining("/confirm-registration?token="),
        html: expect.stringContaining("/confirm-registration?token="),
      })
    );
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("validates required register fields", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: "a@b.ru" })
      .expect(400);

    expect(response.body).toEqual({ message: "Заполни все обязательные поля" });
    expect(mocks.mockPool.connect).not.toHaveBeenCalled();
  });

  it("validates register email", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegisterBody, email: "bad-email" })
      .expect(400);

    expect(response.body.message).toMatch(/корректный email/i);
  });

  it("validates register password", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegisterBody, password: "weak" })
      .expect(400);

    expect(response.body.message).toMatch(/пароль должен/i);
  });

  it("returns 409 when register email already exists", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: 1, email_verified: true }],
      });

    const response = await request(app)
      .post("/api/auth/register")
      .send(validRegisterBody)
      .expect(409);

    expect(response.body).toEqual({ message: "Пользователь с таким email уже существует" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("returns 500 when register transaction fails", async () => {
    mocks.mockClient.query.mockRejectedValueOnce(new Error("db failed"));

    const response = await request(app)
      .post("/api/auth/register")
      .send(validRegisterBody)
      .expect(500);

    expect(response.body).toEqual({ message: "Ошибка сервера при регистрации" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("logs user in", async () => {
    const user = {
      id: 1,
      email: "encrypted:user@example.com",
      password: "hashed",
      role: "volunteer",
      is_active: true,
      email_verified: true,
    };

    mocks.mockPool.query.mockResolvedValue({ rows: [user] });
    mocks.mockCompare.mockResolvedValue(true);
    mocks.mockSign.mockReturnValue("jwt-token");

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: " USER@EXAMPLE.COM ", password: "Password1!" })
      .expect(200);

    expect(response.body).toEqual({
      message: "Вход выполнен",
      token: "jwt-token",
      user: { id: 1, email: "user@example.com", role: "volunteer" },
    });
    expect(mocks.mockCompare).toHaveBeenCalledWith("Password1!", "hashed");
    expect(mocks.mockEnsureNotificationSettings).toHaveBeenCalledWith(1, mocks.mockPool);
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "login", entityType: "auth", entityId: 1 })
    );
  });

  it("validates login required fields", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "" })
      .expect(400);

    expect(response.body).toEqual({ message: "Email и пароль обязательны" });
  });

  it("returns 401 and writes audit log when login user is not found", async () => {
    mocks.mockPool.query.mockResolvedValue({ rows: [] });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "missing@example.com", password: "Password1!" })
      .expect(401);

    expect(response.body).toEqual({ message: "Неверный email или пароль" });
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "login_failed",
        entityType: "auth",
        status: "failed",
        details: expect.objectContaining({ reason: "user_not_found" }),
      })
    );
  });

  it("returns 403 when user is inactive", async () => {
    mocks.mockPool.query.mockResolvedValue({
      rows: [
        {
          id: 1,
          email: "encrypted:u@mail.ru",
          password: "hash",
          role: "volunteer",
          is_active: false,
          email_verified: true,
        },
      ],
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "u@mail.ru", password: "Password1!" })
      .expect(403);

    expect(response.body).toEqual({ message: "Аккаунт деактивирован" });
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "login_blocked", status: "failed" })
    );
  });

  it("returns 403 when email is not verified", async () => {
    mocks.mockPool.query.mockResolvedValue({
      rows: [
        {
          id: 1,
          email: "encrypted:u@mail.ru",
          password: "hash",
          role: "volunteer",
          is_active: true,
          email_verified: false,
        },
      ],
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "u@mail.ru", password: "Password1!" })
      .expect(403);

    expect(response.body).toEqual({
      message: "Подтвердите регистрацию через ссылку из письма",
    });
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "login_blocked",
        status: "failed",
        details: expect.objectContaining({ reason: "email_not_verified" }),
      })
    );
  });

  it("returns 401 when password is invalid", async () => {
    mocks.mockPool.query.mockResolvedValue({
      rows: [
        {
          id: 1,
          email: "encrypted:u@mail.ru",
          password: "hash",
          role: "volunteer",
          is_active: true,
          email_verified: true,
        },
      ],
    });
    mocks.mockCompare.mockResolvedValue(false);

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "u@mail.ru", password: "Wrong1!" })
      .expect(401);

    expect(response.body).toEqual({ message: "Неверный email или пароль" });
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "login_failed",
        details: expect.objectContaining({ reason: "invalid_password" }),
      })
    );
  });

  it("returns 500 when login query fails", async () => {
    mocks.mockPool.query.mockRejectedValue(new Error("db failed"));

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "u@mail.ru", password: "Password1!" })
      .expect(500);

    expect(response.body).toEqual({ message: "Ошибка сервера при входе" });
  });
});

describe("auth.routes coverage branches", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    delete process.env.CLIENT_URL;
    resetClient();
    mocks.mockHash.mockResolvedValue("hashed-password");
    mocks.mockSendMail.mockResolvedValue(undefined);
    mocks.mockEnsureNotificationSettings.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("registers a new user through insert branch and uses default client url", async () => {
    const user = {
      id: 11,
      email: "encrypted:new@example.com",
      role: "volunteer",
      is_active: true,
      email_verified: false,
    };

    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [user] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await request(app)
      .post("/api/auth/register")
      .send({ ...validRegisterBody, email: "NEW@EXAMPLE.COM" })
      .expect(201);

    expect(mocks.mockClient.query.mock.calls[2][0]).toContain("INSERT INTO users");
    expect(mocks.mockClient.query.mock.calls[3][0]).toContain("INSERT INTO profiles");
    expect(mocks.mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "new@example.com",
        text: expect.stringContaining("http://localhost:5173/confirm-registration?token="),
      })
    );
  });
});
