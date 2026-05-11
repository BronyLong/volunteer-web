import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api";

global.fetch = vi.fn();

const localStorageMock = (() => {
  let store = {};

  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
  configurable: true,
});

describe("api.js", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  function mockJsonResponse(data, ok = true) {
    fetch.mockResolvedValue({
      ok,
      headers: {
        get: () => "application/json",
      },
      json: async () => data,
      text: async () => JSON.stringify(data),
    });
  }

  function mockTextResponse(text, ok = true) {
    fetch.mockResolvedValue({
      ok,
      headers: {
        get: () => "text/plain",
      },
      json: async () => {
        throw new Error("json should not be called");
      },
      text: async () => text,
    });
  }

  describe("apiFetch", () => {
    it("adds Authorization header when token exists", async () => {
      localStorage.setItem("token", "test-token");
      mockJsonResponse({ success: true });

      await api.apiFetch("/profile/me");

      expect(fetch).toHaveBeenCalledWith(
        "/api/profile/me",
        expect.objectContaining({
          cache: "no-store",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("does not add Authorization header when token is missing", async () => {
      mockJsonResponse({ success: true });

      await api.apiFetch("/profile/me");

      expect(fetch).toHaveBeenCalledWith(
        "/api/profile/me",
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.anything(),
          }),
        })
      );
    });

    it("uses no-store cache for GET requests", async () => {
      mockJsonResponse({ ok: true });

      await api.apiFetch("/categories", { method: "GET" });

      expect(fetch).toHaveBeenCalledWith(
        "/api/categories",
        expect.objectContaining({
          cache: "no-store",
        })
      );
    });

    it("uses default cache for non-GET requests", async () => {
      mockJsonResponse({ ok: true });

      await api.apiFetch("/events", {
        method: "POST",
        body: JSON.stringify({ title: "Test" }),
      });

      expect(fetch).toHaveBeenCalledWith(
        "/api/events",
        expect.objectContaining({
          cache: "default",
          method: "POST",
        })
      );
    });

    it("merges custom headers", async () => {
      mockJsonResponse({ ok: true });

      await api.apiFetch("/events", {
        headers: {
          "X-Test": "1",
        },
      });

      expect(fetch).toHaveBeenCalledWith(
        "/api/events",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-Test": "1",
          }),
        })
      );
    });

    it("returns parsed json for successful json response", async () => {
      mockJsonResponse({ id: 1, title: "Event" });

      const result = await api.apiFetch("/events/1");

      expect(result).toEqual({ id: 1, title: "Event" });
    });

    it("returns null for successful text response", async () => {
      mockTextResponse("ok", true);

      const result = await api.apiFetch("/health");

      expect(result).toBeNull();
    });

    it("throws json message on failed json response", async () => {
      mockJsonResponse({ message: "JSON error" }, false);

      await expect(api.apiFetch("/profile/me")).rejects.toThrow("JSON error");
    });

    it("throws text message on failed text response", async () => {
      mockTextResponse("Text error", false);

      await expect(api.apiFetch("/profile/me")).rejects.toThrow("Text error");
    });

    it("throws default error when failed response has no message", async () => {
      fetch.mockResolvedValue({
        ok: false,
        headers: {
          get: () => "application/json",
        },
        json: async () => ({}),
        text: async () => "",
      });

      await expect(api.apiFetch("/profile/me")).rejects.toThrow("Ошибка запроса");
    });
  });

  describe("API wrappers", () => {
    it("loginUser calls /auth/login", async () => {
      mockJsonResponse({ token: "t" });

      await api.loginUser({ email: "a@a.ru", password: "123" });

      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "a@a.ru", password: "123" }),
        })
      );
    });

    it("registerUser calls /auth/register", async () => {
      mockJsonResponse({ token: "t" });

      await api.registerUser({ firstName: "Иван" });

      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/register",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ firstName: "Иван" }),
        })
      );
    });

    it("getMyProfile calls /profile/me", async () => {
      mockJsonResponse({ id: 1 });

      await api.getMyProfile();

      expect(fetch).toHaveBeenCalledWith(
        "/api/profile/me",
        expect.objectContaining({
          cache: "no-store",
        })
      );
    });

    it("getProfileById calls /profile/:id", async () => {
      mockJsonResponse({ id: 5 });

      await api.getProfileById(5);

      expect(fetch).toHaveBeenCalledWith(
        "/api/profile/5",
        expect.objectContaining({
          cache: "no-store",
        })
      );
    });

    it("updateMyProfile calls PUT /profile/me", async () => {
      mockJsonResponse({ success: true });

      await api.updateMyProfile({ city: "Москва" });

      expect(fetch).toHaveBeenCalledWith(
        "/api/profile/me",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ city: "Москва" }),
        })
      );
    });

    it("getCategories calls /categories", async () => {
      mockJsonResponse([]);

      await api.getCategories();

      expect(fetch).toHaveBeenCalledWith(
        "/api/categories",
        expect.objectContaining({
          cache: "no-store",
        })
      );
    });

    it("getEventById calls /events/:id", async () => {
      mockJsonResponse({ id: 9 });

      await api.getEventById(9);

      expect(fetch).toHaveBeenCalledWith(
        "/api/events/9",
        expect.objectContaining({
          cache: "no-store",
        })
      );
    });

    it("createEvent calls POST /events", async () => {
      mockJsonResponse({ event: { id: 1 } });

      await api.createEvent({ title: "Новое мероприятие" });

      expect(fetch).toHaveBeenCalledWith(
        "/api/events",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ title: "Новое мероприятие" }),
        })
      );
    });

    it("updateEvent calls PUT /events/:id", async () => {
      mockJsonResponse({ success: true });

      await api.updateEvent(10, { title: "Обновлено" });

      expect(fetch).toHaveBeenCalledWith(
        "/api/events/10",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ title: "Обновлено" }),
        })
      );
    });

    it("deleteEvent calls DELETE /events/:id", async () => {
      mockJsonResponse({ success: true });

      await api.deleteEvent(7);

      expect(fetch).toHaveBeenCalledWith(
        "/api/events/7",
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });

    it("deleteApplication calls DELETE /applications/:id", async () => {
      mockJsonResponse({ success: true });

      await api.deleteApplication(11);

      expect(fetch).toHaveBeenCalledWith(
        "/api/applications/11",
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });

    it("acceptApplication calls PATCH /applications/:id/accept", async () => {
      mockJsonResponse({ success: true });

      await api.acceptApplication(10);

      expect(fetch).toHaveBeenCalledWith(
        "/api/applications/10/accept",
        expect.objectContaining({
          method: "PATCH",
        })
      );
    });

    it("rejectApplication calls PATCH /applications/:id/reject", async () => {
      mockJsonResponse({ success: true });

      await api.rejectApplication(13);

      expect(fetch).toHaveBeenCalledWith(
        "/api/applications/13/reject",
        expect.objectContaining({
          method: "PATCH",
        })
      );
    });

    it("getAdminUsers calls /admin/users", async () => {
      mockJsonResponse([]);

      await api.getAdminUsers();

      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/users",
        expect.objectContaining({
          cache: "no-store",
        })
      );
    });

    it("updateAdminUserRole calls PATCH /admin/users/:id/role", async () => {
      mockJsonResponse({ success: true });

      await api.updateAdminUserRole(7, "coordinator");

      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/users/7/role",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ role: "coordinator" }),
        })
      );
    });

    it("updateAdminUserActive calls PATCH /admin/users/:id/active", async () => {
      mockJsonResponse({ success: true });

      await api.updateAdminUserActive(7, false);

      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/users/7/active",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ is_active: false }),
        })
      );
    });

    it("getAdminEvents calls /admin/events", async () => {
      mockJsonResponse([]);

      await api.getAdminEvents();

      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/events",
        expect.objectContaining({
          cache: "no-store",
        })
      );
    });

    it("updateAdminEventCoordinator calls PATCH /admin/events/:id/coordinator", async () => {
      mockJsonResponse({ success: true });

      await api.updateAdminEventCoordinator(9, 2);

      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/events/9/coordinator",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ coordinator_id: 2 }),
        })
      );
    });

    it("getAdminLogs calls /admin/logs without query when filters are empty", async () => {
      mockJsonResponse([]);

      await api.getAdminLogs();

      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/logs",
        expect.objectContaining({
          cache: "no-store",
        })
      );
    });

    it("getAdminLogs builds query from non-empty filters", async () => {
      mockJsonResponse([]);

      await api.getAdminLogs({
        user_id: 1,
        action: "UPDATE",
        empty: "",
        spaces: "   ",
        nullable: null,
        missing: undefined,
      });

      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/logs?user_id=1&action=UPDATE",
        expect.objectContaining({
          cache: "no-store",
        })
      );
    });
  });

  describe("token helpers", () => {
    it("saveToken stores token", () => {
      api.saveToken("abc");
      expect(localStorage.setItem).toHaveBeenCalledWith("token", "abc");
      expect(api.getToken()).toBe("abc");
    });

    it("removeToken removes token", () => {
      localStorage.setItem("token", "abc");

      api.removeToken();

      expect(localStorage.removeItem).toHaveBeenCalledWith("token");
      expect(api.getToken()).toBeNull();
    });

    it("getUserIdFromToken returns id from valid token", () => {
      const payload = btoa(JSON.stringify({ id: 123, role: "volunteer" }));
      localStorage.setItem("token", `a.${payload}.c`);

      expect(api.getUserIdFromToken()).toBe(123);
    });

    it("getUserIdFromToken returns null when token is missing", () => {
      expect(api.getUserIdFromToken()).toBeNull();
    });

    it("getUserIdFromToken returns null for invalid token", () => {
      localStorage.setItem("token", "invalid.token");

      expect(api.getUserIdFromToken()).toBeNull();
    });

    it("getUserFromToken returns parsed payload", () => {
      const payload = { id: 15, role: "admin" };
      localStorage.setItem("token", `a.${btoa(JSON.stringify(payload))}.c`);

      expect(api.getUserFromToken()).toEqual(payload);
    });

    it("getUserFromToken returns null when token is missing", () => {
      expect(api.getUserFromToken()).toBeNull();
    });

    it("getUserFromToken returns null for invalid token", () => {
      localStorage.setItem("token", "bad.token");

      expect(api.getUserFromToken()).toBeNull();
    });
  });

  it("handles missing content-type header as text response", async () => {
    fetch.mockResolvedValue({
      ok: true,
      headers: {
        get: () => null,
      },
      json: async () => {
        throw new Error("json should not be called");
      },
      text: async () => "",
    });
  
    const result = await api.apiFetch("/health");
  
    expect(result).toBeNull();
  });
});