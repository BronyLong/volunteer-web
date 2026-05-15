import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/testApp.js";

const mocks = vi.hoisted(() => {
  const mockClient = { query: vi.fn(), release: vi.fn() };

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

vi.mock("../db.js", () => ({ pool: mocks.mockPool }));
vi.mock("../utils/audit.js", () => ({ writeAuditLog: mocks.mockWriteAuditLog }));
vi.mock("../utils/email.js", () => ({ sendMail: mocks.mockSendMail }));
vi.mock("../utils/notifications.js", () => ({
  ensureNotificationSettings: mocks.mockEnsureNotificationSettings,
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

function resetMocks() {
  mocks.mockPool.query.mockReset();
  mocks.mockPool.connect.mockClear();
  mocks.mockClient.query.mockReset();
  mocks.mockClient.release.mockReset();
  mocks.mockHash.mockReset();
  mocks.mockCompare.mockReset();
  mocks.mockSign.mockReset();
  mocks.mockWriteAuditLog.mockReset();
  mocks.mockSendMail.mockReset();
  mocks.mockEnsureNotificationSettings.mockReset();
}

describe("auth.routes email confirmation and password reset", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    process.env.CLIENT_URL = "http://client.test/";
    resetMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("validates personal data consent during registration", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegisterBody, personalDataConsent: false })
      .expect(400);

    expect(response.body).toEqual({
      message: "Для регистрации необходимо согласие на обработку персональных данных",
    });
    expect(mocks.mockPool.connect).not.toHaveBeenCalled();
  });

  it("validates gender during registration", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegisterBody, gender: "unknown" })
      .expect(400);

    expect(response.body).toEqual({ message: "Выберите корректное значение пола" });
    expect(mocks.mockPool.connect).not.toHaveBeenCalled();
  });

  it("updates unconfirmed user during repeated registration and sends confirmation email", async () => {
    const existingUser = {
      id: 7,
      email: "old@mail.ru",
      role: "volunteer",
      is_active: false,
      email_verified: false,
    };

    mocks.mockHash.mockResolvedValue("hashed-password");
    mocks.mockEnsureNotificationSettings.mockResolvedValue();
    mocks.mockSendMail.mockResolvedValue({ skipped: true });
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [existingUser] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post("/api/auth/register")
      .send(validRegisterBody)
      .expect(201);

    expect(response.body).toEqual({
      message: "Регистрация почти завершена. Мы отправили письмо со ссылкой для подтверждения аккаунта.",
    });
    expect(mocks.mockClient.query.mock.calls[2][0]).toContain("UPDATE users");
    expect(mocks.mockClient.query.mock.calls[3][0]).toContain("INSERT INTO profiles");
    expect(mocks.mockClient.query.mock.calls[4][0]).toContain("UPDATE auth_email_tokens");
    expect(mocks.mockEnsureNotificationSettings).toHaveBeenCalledWith(7, mocks.mockClient);
    expect(mocks.mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@example.com",
        subject: "Рука помощи: подтвердите регистрацию",
        text: expect.stringContaining("http://client.test/confirm-registration?token="),
      })
    );
  });

  it("confirms registration by valid token", async () => {
    const tokenRow = {
      id: 3,
      user_id: 7,
      email: "user@mail.ru",
      role: "volunteer",
      is_active: true,
      email_verified: false,
    };
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [tokenRow] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post("/api/auth/confirm-registration")
      .send({ token: "plain-token" })
      .expect(200);

    expect(response.body).toEqual({
      message: "Регистрация подтверждена. Теперь вы можете войти в аккаунт.",
    });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("COMMIT");
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        action: "registration_confirmed",
        entityType: "user",
        entityId: 7,
        db: mocks.mockClient,
      })
    );
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("validates missing registration confirmation token", async () => {
    const response = await request(app)
      .post("/api/auth/confirm-registration")
      .send({ token: "" })
      .expect(400);

    expect(response.body).toEqual({ message: "Токен подтверждения обязателен" });
    expect(mocks.mockPool.connect).not.toHaveBeenCalled();
  });

  it("rejects invalid registration confirmation token", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post("/api/auth/confirm-registration")
      .send({ token: "bad-token" })
      .expect(400);

    expect(response.body).toEqual({
      message: "Ссылка подтверждения недействительна или устарела",
    });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("returns fallback error when registration confirmation fails", async () => {
    mocks.mockClient.query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error("db failed"));

    const response = await request(app)
      .post("/api/auth/confirm-registration")
      .send({ token: "token" })
      .expect(500);

    expect(response.body).toEqual({ message: "Ошибка сервера при подтверждении регистрации" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("validates missing forgot password email", async () => {
    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "" })
      .expect(400);

    expect(response.body).toEqual({ message: "Email обязателен" });
  });

  it("validates forgot password email format", async () => {
    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "bad-email" })
      .expect(400);

    expect(response.body.message).toMatch(/корректный email/i);
  });

  it("sends reset password email for active verified user", async () => {
    const user = {
      id: 4,
      email: "user@mail.ru",
      role: "volunteer",
      is_active: true,
      email_verified: true,
    };
    mocks.mockPool.query
      .mockResolvedValueOnce({ rows: [user] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    mocks.mockSendMail.mockResolvedValue({ skipped: true });

    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: " USER@MAIL.RU " })
      .expect(200);

    expect(response.body).toEqual({
      message: "Если аккаунт с таким email существует, мы отправили письмо со ссылкой для восстановления доступа.",
    });
    expect(mocks.mockPool.query.mock.calls[1][0]).toContain("UPDATE auth_email_tokens");
    expect(mocks.mockPool.query.mock.calls[2][0]).toContain("INSERT INTO auth_email_tokens");
    expect(mocks.mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@mail.ru",
        subject: "Рука помощи: восстановление доступа",
        text: expect.stringContaining("http://client.test/reset-password?token="),
      })
    );
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "password_reset_requested", userId: 4 })
    );
  });

  it("returns same forgot password response when user does not exist", async () => {
    mocks.mockPool.query.mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "missing@mail.ru" })
      .expect(200);

    expect(response.body.message).toMatch(/Если аккаунт с таким email существует/i);
    expect(mocks.mockSendMail).not.toHaveBeenCalled();
  });

  it("does not send reset email to inactive or unverified user", async () => {
    mocks.mockPool.query.mockResolvedValueOnce({
      rows: [{ id: 4, email: "user@mail.ru", role: "volunteer", is_active: false, email_verified: true }],
    });

    await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "user@mail.ru" })
      .expect(200);

    expect(mocks.mockPool.query).toHaveBeenCalledTimes(1);
    expect(mocks.mockSendMail).not.toHaveBeenCalled();
  });

  it("returns fallback error when forgot password fails", async () => {
    mocks.mockPool.query.mockRejectedValue(new Error("db failed"));

    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "user@mail.ru" })
      .expect(500);

    expect(response.body).toEqual({ message: "Ошибка сервера при восстановлении доступа" });
  });

  it("validates missing reset password token and password", async () => {
    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "", password: "" })
      .expect(400);

    expect(response.body).toEqual({ message: "Токен и новый пароль обязательны" });
  });

  it("validates reset password strength", async () => {
    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "token", password: "weak" })
      .expect(400);

    expect(response.body.message).toMatch(/Пароль должен/i);
  });

  it("resets password for valid token", async () => {
    const tokenRow = {
      id: 10,
      user_id: 4,
      email: "user@mail.ru",
      role: "volunteer",
      is_active: true,
      email_verified: true,
    };
    mocks.mockHash.mockResolvedValue("new-hash");
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [tokenRow] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "token", password: "NewPassword1!" })
      .expect(200);

    expect(response.body).toEqual({
      message: "Пароль изменен. Теперь вы можете войти с новым паролем.",
    });
    expect(mocks.mockHash).toHaveBeenCalledWith("NewPassword1!", 10);
    expect(mocks.mockClient.query.mock.calls[2][1]).toEqual(["new-hash", 4]);
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "password_reset_completed", userId: 4, db: mocks.mockClient })
    );
  });

  it("rejects invalid reset password token", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "bad", password: "NewPassword1!" })
      .expect(400);

    expect(response.body).toEqual({ message: "Ссылка восстановления недействительна или устарела" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("rejects reset password for inactive user", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ user_id: 4, email: "user@mail.ru", role: "volunteer", is_active: false, email_verified: true }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "token", password: "NewPassword1!" })
      .expect(403);

    expect(response.body).toEqual({ message: "Аккаунт деактивирован" });
  });

  it("rejects reset password for unverified user", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ user_id: 4, email: "user@mail.ru", role: "volunteer", is_active: true, email_verified: false }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "token", password: "NewPassword1!" })
      .expect(403);

    expect(response.body).toEqual({ message: "Сначала подтвердите регистрацию через email" });
  });

  it("returns fallback error when reset password fails", async () => {
    mocks.mockClient.query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error("db failed"));

    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "token", password: "NewPassword1!" })
      .expect(500);

    expect(response.body).toEqual({ message: "Ошибка сервера при изменении пароля" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });
});
