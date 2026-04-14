import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import LoginPage from "../src/pages/LoginPage";

vi.mock("../src/api", async () => {
  const actual = await vi.importActual("../src/api");
  return {
    ...actual,
    login: vi.fn(() => Promise.resolve({ token: "test-token" })),
  };
});

describe("LoginPage", () => {
  it("renders form fields", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^пароль$/i)).toBeInTheDocument();
  });

  it("allows typing", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <LoginPage />
      </MemoryRouter>
    );

    const email = screen.getByLabelText(/email/i);
    const password = screen.getByLabelText(/^пароль$/i);

    fireEvent.change(email, { target: { value: "test@mail.com" } });
    fireEvent.change(password, { target: { value: "12345678" } });

    expect(email.value).toBe("test@mail.com");
    expect(password.value).toBe("12345678");
  });

  it("renders submit button", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <LoginPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("button", { name: /^войти$/i })
    ).toBeInTheDocument();
  });

  it("renders link to register page", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <LoginPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("link", { name: /зарегистрироваться/i })
    ).toBeInTheDocument();
  });
});