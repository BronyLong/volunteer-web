import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import Footer from "../src/components/Footer";

const mockGetUserIdFromToken = vi.fn();

vi.mock("../src/api", async () => {
  const actual = await vi.importActual("../src/api");
  return {
    ...actual,
    getUserIdFromToken: (...args) => mockGetUserIdFromToken(...args),
  };
});

beforeEach(() => {
  mockGetUserIdFromToken.mockReturnValue(null);
});

describe("Footer", () => {
  it("renders footer links", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Footer />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("link", { name: /логотипрука помощи/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /хочу помочь/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /нужна помощь/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /регистрация/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /^войти$/i })
    ).toBeInTheDocument();
  });

  it("renders profile link", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Footer />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("link", { name: /личный кабинет/i })
    ).toBeInTheDocument();
  });

  it("links personal account to profile when token contains user id", () => {
    mockGetUserIdFromToken.mockReturnValue(42);
  
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Footer />
      </MemoryRouter>
    );
  
    expect(
      screen.getByRole("link", { name: /личный кабинет/i })
    ).toHaveAttribute("href", "/profiles/42");
  });
});