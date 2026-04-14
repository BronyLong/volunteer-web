import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import RegisterPage from "../src/pages/RegisterPage";

vi.mock("../src/api", async () => {
  const actual = await vi.importActual("../src/api");
  return {
    ...actual,
    register: vi.fn(() => Promise.resolve({ token: "test-token" })),
  };
});

describe("RegisterPage", () => {
  it("renders registration form fields", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <RegisterPage />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/имя/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/фамилия/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^пароль$/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/подтверждение пароля/i)
    ).toBeInTheDocument();
  });

  it("allows typing into fields", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <RegisterPage />
      </MemoryRouter>
    );

    const firstName = screen.getByLabelText(/имя/i);
    const lastName = screen.getByLabelText(/фамилия/i);
    const email = screen.getByLabelText(/email/i);
    const password = screen.getByLabelText(/^пароль$/i);
    const confirmPassword = screen.getByLabelText(/подтверждение пароля/i);

    fireEvent.change(firstName, { target: { value: "Иван" } });
    fireEvent.change(lastName, { target: { value: "Иванов" } });
    fireEvent.change(email, { target: { value: "test@mail.com" } });
    fireEvent.change(password, { target: { value: "12345678" } });
    fireEvent.change(confirmPassword, { target: { value: "12345678" } });

    expect(firstName.value).toBe("Иван");
    expect(lastName.value).toBe("Иванов");
    expect(email.value).toBe("test@mail.com");
    expect(password.value).toBe("12345678");
    expect(confirmPassword.value).toBe("12345678");
  });

  it("renders submit button", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <RegisterPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("button", { name: /создать аккаунт/i })
    ).toBeInTheDocument();
  });

  it("renders link to login page", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <RegisterPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("link", { name: /^войти$/i })
    ).toBeInTheDocument();
  });
});