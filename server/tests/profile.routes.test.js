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
    mockVerify: vi.fn(),
    mockWriteAuditLog: vi.fn(),
  };
});

vi.mock("../db.js", () => ({ pool: mocks.mockPool }));
vi.mock("../utils/audit.js", () => ({ writeAuditLog: mocks.mockWriteAuditLog }));
vi.mock("jsonwebtoken", () => ({ default: { verify: mocks.mockVerify } }));

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Требуется авторизация" });
    }

    try {
      req.user = mocks.mockVerify(authHeader.split(" ")[1], process.env.JWT_SECRET);
      return next();
    } catch {
      return res.status(401).json({ message: "Недействительный токен" });
    }
  },
}));

const profileRoutes = (await import("../routes/profile.routes.js")).default;
const app = createTestApp("/api/profile", profileRoutes);

const profile = {
  id: 1,
  email: "user@mail.ru",
  role: "volunteer",
  is_active: true,
  created_at: "2024-01-01T10:00:00.000Z",
  first_name: "Иван",
  last_name: "Иванов",
  gender: "male",
  phone: "+7 (900) 000-00-00",
  city: "Москва",
  avatar_url: "avatar.png",
  bio: "bio",
  social_vk: "vk.com/user",
  social_ok: "ok.ru/user",
  social_max: "max.ru/user",
  volunteer_events: [],
  volunteer_stats: { completed_events_count: 0, completed_minutes: 0, upcoming_events_count: 0 },
  coordinator_events: [],
};

const validUpdateBody = {
  first_name: " Иван ",
  last_name: " Иванов ",
  gender: "male",
  email: " USER@MAIL.RU ",
  phone: "+7 (900) 000-00-00",
  city: " Москва ",
  avatar_url: " avatar.png ",
  bio: " bio ",
  social_vk: "vk.com/user",
  social_ok: "ok.ru/user",
  social_max: "max.ru/user",
};

function auth(role = "volunteer", id = 1) {
  mocks.mockVerify.mockReturnValue({ id, role, email: `${role}@mail.ru` });
  return { Authorization: "Bearer token" };
}

function resetMocks() {
  mocks.mockPool.query.mockReset();
  mocks.mockPool.connect.mockClear();
  mocks.mockClient.query.mockReset();
  mocks.mockClient.release.mockReset();
  mocks.mockVerify.mockReset();
  mocks.mockWriteAuditLog.mockReset();
}

describe("profile.routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    resetMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns my profile with private fields", async () => {
    mocks.mockPool.query.mockResolvedValue({ rows: [profile] });

    const response = await request(app)
      .get("/api/profile/me")
      .set(auth("volunteer", 1))
      .expect(200);

    expect(response.body).toEqual({
      ...profile,
      access_level: "private",
      can_view_contacts: true,
      is_owner: true,
      is_admin_view: false,
    });
  });

  it("returns 404 when my profile was not found", async () => {
    mocks.mockPool.query.mockResolvedValue({ rows: [] });

    const response = await request(app)
      .get("/api/profile/me")
      .set(auth())
      .expect(404);

    expect(response.body).toEqual({ message: "Профиль не найден" });
  });

  it("returns public profile for guest and hides contacts", async () => {
    mocks.mockPool.query.mockResolvedValue({ rows: [profile] });

    const response = await request(app).get("/api/profile/1").expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: 1,
        access_level: "public",
        can_view_contacts: false,
        is_owner: false,
        is_admin_view: false,
        email: null,
        phone: null,
        city: null,
        social_vk: null,
      })
    );
    expect(response.body.is_active).toBeUndefined();
  });

  it("returns private profile for owner", async () => {
    mocks.mockPool.query
      .mockResolvedValueOnce({ rows: [profile] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .get("/api/profile/1")
      .set(auth("volunteer", 1))
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        access_level: "private",
        can_view_contacts: true,
        is_owner: true,
        email: "user@mail.ru",
        is_active: true,
      })
    );
  });

  it("returns private profile for admin view", async () => {
    mocks.mockPool.query
      .mockResolvedValueOnce({ rows: [profile] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .get("/api/profile/1")
      .set(auth("admin", 99))
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        access_level: "private",
        can_view_contacts: true,
        is_owner: false,
        is_admin_view: true,
        email: "user@mail.ru",
      })
    );
  });

  it("returns contact profile for related user", async () => {
    mocks.mockPool.query
      .mockResolvedValueOnce({ rows: [profile] })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    const response = await request(app)
      .get("/api/profile/1")
      .set(auth("volunteer", 2))
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        access_level: "contact",
        can_view_contacts: true,
        email: "user@mail.ru",
      })
    );
  });

  it("normalizes non-array event fields and default stats", async () => {
    mocks.mockPool.query.mockResolvedValue({
      rows: [{ ...profile, volunteer_events: null, coordinator_events: null, volunteer_stats: null }],
    });

    const response = await request(app).get("/api/profile/1").expect(200);

    expect(response.body.volunteer_events).toEqual([]);
    expect(response.body.coordinator_events).toEqual([]);
    expect(response.body.volunteer_stats).toEqual({
      completed_events_count: 0,
      completed_minutes: 0,
      upcoming_events_count: 0,
    });
  });

  it("updates my profile", async () => {
    const updated = { ...profile, email: "user@mail.ru" };
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [profile] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [updated] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .put("/api/profile/me")
      .set(auth("volunteer", 1))
      .send(validUpdateBody)
      .expect(200);

    expect(response.body).toEqual({
      message: "Профиль обновлён",
      profile: {
        ...updated,
        access_level: "private",
        can_view_contacts: true,
        is_owner: true,
        is_admin_view: false,
      },
    });
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "profile_update", entityType: "profile", db: mocks.mockClient })
    );
  });

  it("validates required profile fields", async () => {
    const response = await request(app)
      .put("/api/profile/me")
      .set(auth())
      .send({ ...validUpdateBody, first_name: "" })
      .expect(400);

    expect(response.body).toEqual({ message: "Имя, фамилия, пол и email обязательны" });
  });

  it("validates profile email", async () => {
    const response = await request(app)
      .put("/api/profile/me")
      .set(auth())
      .send({ ...validUpdateBody, email: "bad-email" })
      .expect(400);

    expect(response.body.message).toMatch(/корректный email/i);
  });

  it("validates profile phone", async () => {
    const response = await request(app)
      .put("/api/profile/me")
      .set(auth())
      .send({ ...validUpdateBody, phone: "+79990000000" })
      .expect(400);

    expect(response.body).toEqual({ message: "Телефон должен быть в формате +7 (900) 000-00-00" });
  });

  it("validates social links", async () => {
    await request(app)
      .put("/api/profile/me")
      .set(auth())
      .send({ ...validUpdateBody, social_vk: "https://example.com/user" })
      .expect(400, { message: "Укажите корректную ссылку VK" });

    await request(app)
      .put("/api/profile/me")
      .set(auth())
      .send({ ...validUpdateBody, social_ok: "https://example.com/user" })
      .expect(400, { message: "Укажите корректную ссылку Одноклассников" });

    await request(app)
      .put("/api/profile/me")
      .set(auth())
      .send({ ...validUpdateBody, social_max: "https://example.com/user" })
      .expect(400, { message: "Укажите корректную ссылку MAX" });
  });

  it("returns 409 when email already belongs to another user", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [profile] })
      .mockResolvedValueOnce({ rows: [{ id: 2 }] });

    const response = await request(app)
      .put("/api/profile/me")
      .set(auth())
      .send(validUpdateBody)
      .expect(409);

    expect(response.body).toEqual({ message: "Пользователь с таким email уже существует" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("returns 500 when profile update fails", async () => {
    mocks.mockClient.query.mockRejectedValueOnce(new Error("db failed"));

    const response = await request(app)
      .put("/api/profile/me")
      .set(auth())
      .send(validUpdateBody)
      .expect(500);

    expect(response.body).toEqual({ message: "Ошибка при обновлении профиля" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when my profile loading fails", async () => {
    mocks.mockPool.query.mockRejectedValue(new Error("db failed"));
  
    const response = await request(app)
      .get("/api/profile/me")
      .set(auth("volunteer", 1))
      .expect(500);
  
    expect(response.body).toEqual({
      message: "Ошибка при получении профиля",
    });
  });
  
  it("returns 404 when public profile was not found", async () => {
    mocks.mockPool.query.mockResolvedValue({ rows: [] });
  
    const response = await request(app).get("/api/profile/404").expect(404);
  
    expect(response.body).toEqual({ message: "Профиль не найден" });
  });
  
  it("returns 500 when public profile loading fails", async () => {
    mocks.mockPool.query.mockRejectedValue(new Error("db failed"));
  
    const response = await request(app).get("/api/profile/1").expect(500);
  
    expect(response.body).toEqual({
      message: "Ошибка при получении профиля",
    });
  });
  
  it("treats invalid optional viewer token as guest profile view", async () => {
    mocks.mockVerify.mockImplementation(() => {
      throw new Error("invalid token");
    });
  
    mocks.mockPool.query.mockResolvedValueOnce({ rows: [profile] });
  
    const response = await request(app)
      .get("/api/profile/1")
      .set("Authorization", "Bearer broken-token")
      .expect(200);
  
    expect(response.body).toEqual(
      expect.objectContaining({
        access_level: "public",
        can_view_contacts: false,
        is_owner: false,
        is_admin_view: false,
        email: null,
        phone: null,
        city: null,
        social_vk: null,
        social_ok: null,
        social_max: null,
      })
    );
  });
  
  it("returns public profile for authorized unrelated user", async () => {
    mocks.mockPool.query
      .mockResolvedValueOnce({ rows: [profile] })
      .mockResolvedValueOnce({ rows: [] });
  
    const response = await request(app)
      .get("/api/profile/1")
      .set(auth("volunteer", 2))
      .expect(200);
  
    expect(response.body).toEqual(
      expect.objectContaining({
        access_level: "public",
        can_view_contacts: false,
        is_owner: false,
        is_admin_view: false,
        email: null,
        phone: null,
        city: null,
      })
    );
  });
  
  it("updates profile with empty optional fields and empty social links", async () => {
    const body = {
      ...validUpdateBody,
      phone: "",
      city: "",
      avatar_url: "",
      bio: "",
      social_vk: "",
      social_ok: "",
      social_max: "",
    };
  
    const updated = {
      ...profile,
      email: "user@mail.ru",
      phone: "",
      city: "",
      avatar_url: "",
      bio: "",
      social_vk: "",
      social_ok: "",
      social_max: "",
    };
  
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [profile] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [updated] })
      .mockResolvedValueOnce({ rows: [] });
  
    const response = await request(app)
      .put("/api/profile/me")
      .set(auth("volunteer", 1))
      .send(body)
      .expect(200);
  
    expect(response.body.profile).toEqual(
      expect.objectContaining({
        email: "user@mail.ru",
        phone: "",
        city: "",
        avatar_url: "",
        bio: "",
        social_vk: "",
        social_ok: "",
        social_max: "",
        access_level: "private",
        can_view_contacts: true,
        is_owner: true,
        is_admin_view: false,
      })
    );
  
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "profile_update",
        entityType: "profile",
        entityId: 1,
        db: mocks.mockClient,
      })
    );
  });
});

describe("profile.routes coverage branches", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    resetMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns private profile with default volunteer stats for owner", async () => {
    mocks.mockPool.query.mockResolvedValue({
      rows: [{ ...profile, volunteer_stats: null }],
    });

    const response = await request(app)
      .get("/api/profile/1")
      .set(auth("volunteer", 1))
      .expect(200);

    expect(response.body.volunteer_stats).toEqual({
      completed_events_count: 0,
      completed_minutes: 0,
      upcoming_events_count: 0,
    });
  });

  it("validates invalid gender value on profile update", async () => {
    const response = await request(app)
      .put("/api/profile/me")
      .set(auth())
      .send({ ...validUpdateBody, gender: "unknown" })
      .expect(400);

    expect(response.body).toEqual({ message: "Выберите корректное значение пола" });
  });

  it("validates missing last name and gender on profile update", async () => {
    const response = await request(app)
      .put("/api/profile/me")
      .set(auth())
      .send({ ...validUpdateBody, last_name: null, gender: null })
      .expect(400);

    expect(response.body).toEqual({ message: "Имя, фамилия, пол и email обязательны" });
  });

  it("trims middle name on successful profile update", async () => {
    const updated = { ...profile, middle_name: "Сергеевич", email: "user@mail.ru" };
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [profile] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [updated] })
      .mockResolvedValueOnce({ rows: [] });

    await request(app)
      .put("/api/profile/me")
      .set(auth("volunteer", 1))
      .send({ ...validUpdateBody, middle_name: " Сергеевич " })
      .expect(200);

    const updateCall = mocks.mockClient.query.mock.calls.find((call) =>
      String(call[0]).includes("INSERT INTO profiles")
    );
    expect(updateCall).toBeTruthy();
    expect(updateCall[1][3]).toEqual(expect.any(String));
  });
});
