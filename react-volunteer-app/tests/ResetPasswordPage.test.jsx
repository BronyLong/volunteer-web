import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResetPasswordPage from "../src/pages/ResetPasswordPage";

const mockResetPassword = vi.fn();

vi.mock("../src/api", async () => {
  const actual = await vi.importActual("../src/api");
  return {
    ...actual,
    resetPassword: (...args) => mockResetPassword(...args),
  };
});

function renderPage(initialEntry = "/reset-password?token=reset-token") {
  return render(
    <MemoryRouter
      initialEntries={[initialEntry]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ResetPasswordPage />
    </MemoryRouter>
  );
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders reset password form", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /новый пароль/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^новый пароль$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/подтверждение пароля/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /перейти ко входу/i })).toHaveAttribute("href", "/login");
  });

  it("shows error and disables submit when token is missing", async () => {
    renderPage("/reset-password");

    expect(screen.getByRole("button", { name: /сохранить пароль/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/^новый пароль$/i), {
      target: { value: "12345678" },
    });
    fireEvent.change(screen.getByLabelText(/подтверждение пароля/i), {
      target: { value: "12345678" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /сохранить пароль/i }).closest("form"));

    expect(await screen.findByText(/ссылка восстановления некорректна/i)).toBeInTheDocument();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it("shows password mismatch error", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/^новый пароль$/i), {
      target: { value: "12345678" },
    });
    fireEvent.change(screen.getByLabelText(/подтверждение пароля/i), {
      target: { value: "87654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: /сохранить пароль/i }));

    expect(await screen.findByText(/пароли не совпадают/i)).toBeInTheDocument();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it("resets password and clears fields", async () => {
    mockResetPassword.mockResolvedValue({ message: "Пароль обновлен" });

    renderPage();

    const password = screen.getByLabelText(/^новый пароль$/i);
    const confirmPassword = screen.getByLabelText(/подтверждение пароля/i);

    fireEvent.change(password, { target: { value: "12345678" } });
    fireEvent.change(confirmPassword, { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: /сохранить пароль/i }));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith({
        token: "reset-token",
        password: "12345678",
      });
    });

    expect(await screen.findByText("Пароль обновлен")).toBeInTheDocument();
    expect(password.value).toBe("");
    expect(confirmPassword.value).toBe("");
  });

  it("shows fallback success message", async () => {
    mockResetPassword.mockResolvedValue({});

    renderPage();

    fireEvent.change(screen.getByLabelText(/^новый пароль$/i), {
      target: { value: "12345678" },
    });
    fireEvent.change(screen.getByLabelText(/подтверждение пароля/i), {
      target: { value: "12345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: /сохранить пароль/i }));

    expect(await screen.findByText(/пароль изменен/i)).toBeInTheDocument();
  });

  it("shows request and fallback errors", async () => {
    mockResetPassword.mockRejectedValueOnce(new Error("Токен истек"));

    const { rerender } = renderPage();

    fireEvent.change(screen.getByLabelText(/^новый пароль$/i), {
      target: { value: "12345678" },
    });
    fireEvent.change(screen.getByLabelText(/подтверждение пароля/i), {
      target: { value: "12345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: /сохранить пароль/i }));

    expect(await screen.findByText("Токен истек")).toBeInTheDocument();

    mockResetPassword.mockRejectedValueOnce({});

    rerender(
      <MemoryRouter
        initialEntries={["/reset-password?token=reset-token"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <ResetPasswordPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/^новый пароль$/i), {
      target: { value: "12345678" },
    });
    fireEvent.change(screen.getByLabelText(/подтверждение пароля/i), {
      target: { value: "12345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: /сохранить пароль/i }));

    expect(await screen.findByText(/не удалось изменить пароль/i)).toBeInTheDocument();
  });
});
