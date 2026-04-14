import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import Header from "../src/components/Header";

vi.mock("../src/api", async () => {
  const actual = await vi.importActual("../src/api");
  return {
    ...actual,
    getToken: vi.fn(() => null),
    getUserFromToken: vi.fn(() => null),
    getUserIdFromToken: vi.fn(() => null),
  };
});

describe("Header", () => {
  it("renders guest navigation links", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Header />
      </MemoryRouter>
    );

    expect(
      screen.getAllByRole("link", { name: /хочу помочь/i }).length
    ).toBeGreaterThan(0);

    expect(
      screen.getAllByRole("link", { name: /регистрация/i }).length
    ).toBeGreaterThan(0);

    expect(
      screen.getAllByRole("link", { name: /войти/i }).length
    ).toBeGreaterThan(0);
  });

  it("renders logo link", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Header />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("link", { name: /логотипрука помощи/i })
    ).toBeInTheDocument();
  });

  it("renders help button", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Header />
      </MemoryRouter>
    );

    expect(
      screen.getAllByRole("button", { name: /нужна помощь/i }).length
    ).toBeGreaterThan(0);
  });
});