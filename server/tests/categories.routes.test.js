import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/testApp.js";

const mockPool = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("../db.js", () => ({
  pool: mockPool,
}));

const categoriesRoutes = (await import("../routes/categories.routes.js")).default;
const app = createTestApp("/api/categories", categoriesRoutes);

describe("categories.routes", () => {
  beforeEach(() => {
    mockPool.query.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns categories sorted by id", async () => {
    const rows = [
      { id: 1, name: "Экология" },
      { id: 2, name: "Дети" },
    ];
    mockPool.query.mockResolvedValue({ rows });

    const response = await request(app).get("/api/categories").expect(200);

    expect(response.body).toEqual(rows);
    expect(mockPool.query.mock.calls[0][0]).toContain("ORDER BY id ASC");
  });

  it("returns 500 when db request fails", async () => {
    mockPool.query.mockRejectedValue(new Error("db failed"));

    const response = await request(app).get("/api/categories").expect(500);

    expect(response.body).toEqual({ message: "Не удалось получить категории" });
    expect(console.error).toHaveBeenCalled();
  });
});
