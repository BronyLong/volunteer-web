import { describe, it, expect, vi, beforeEach } from "vitest";
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
});

describe("api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("adds Authorization header when token exists", async () => {
    localStorage.setItem("token", "test-token");

    fetch.mockResolvedValue({
      ok: true,
      headers: {
        get: () => "application/json",
      },
      json: async () => ({ success: true }),
    });

    await api.getMyProfile();

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      })
    );
  });

  it("does not add Authorization header when no token", async () => {
    fetch.mockResolvedValue({
      ok: true,
      headers: {
        get: () => "application/json",
      },
      json: async () => ({ success: true }),
    });

    await api.getMyProfile();

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.anything(),
        }),
      })
    );
  });

  it("throws error on non-ok response", async () => {
    fetch.mockResolvedValue({
      ok: false,
      headers: {
        get: () => "text/plain",
      },
      text: async () => "Error message",
    });

    await expect(api.getMyProfile()).rejects.toThrow("Error message");
  });

  it("parses json response", async () => {
    fetch.mockResolvedValue({
      ok: true,
      headers: {
        get: () => "application/json",
      },
      json: async () => ({ id: 1 }),
    });

    const result = await api.getMyProfile();

    expect(result).toEqual({ id: 1 });
  });
});