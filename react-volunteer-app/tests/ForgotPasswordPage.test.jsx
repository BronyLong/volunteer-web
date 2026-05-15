import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordPage from "../src/pages/ForgotPasswordPage";

const mockRequestPasswordReset = vi.fn();

vi.mock("../src/api", async () => {
  const actual = await vi.importActual("../src/api");
  return {
    ...actual,
    requestPasswordReset: (...args) => mockRequestPasswordReset(...args),
  };
});

function renderPage() {
  return render(
    <MemoryRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ForgotPasswordPage />
    </MemoryRouter>
  );
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders password reset form", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /восстановление доступа/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /отправить ссылку/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /вернуться ко входу/i })).toHaveAttribute("href", "/login");
  });

  it("sends password reset request and shows server message", async () => {
    mockRequestPasswordReset.mockResolvedValue({
      message: "Письмо отправлено",
    });

    renderPage();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@mail.ru" },
    });
    fireEvent.click(screen.getByRole("button", { name: /отправить ссылку/i }));

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith("user@mail.ru");
    });

    expect(await screen.findByText("Письмо отправлено")).toBeInTheDocument();
  });

  it("shows fallback success message when api returns no message", async () => {
    mockRequestPasswordReset.mockResolvedValue({});

    renderPage();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@mail.ru" },
    });
    fireEvent.click(screen.getByRole("button", { name: /отправить ссылку/i }));

    expect(
      await screen.findByText(/если аккаунт с таким email существует/i)
    ).toBeInTheDocument();
  });

  it("shows request error from api", async () => {
    mockRequestPasswordReset.mockRejectedValue(new Error("Email не найден"));

    renderPage();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "missing@mail.ru" },
    });
    fireEvent.click(screen.getByRole("button", { name: /отправить ссылку/i }));

    expect(await screen.findByText("Email не найден")).toBeInTheDocument();
  });

  it("shows fallback error when api throws without message", async () => {
    mockRequestPasswordReset.mockRejectedValue({});

    renderPage();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "missing@mail.ru" },
    });
    fireEvent.click(screen.getByRole("button", { name: /отправить ссылку/i }));

    expect(
      await screen.findByText(/не удалось отправить письмо для восстановления доступа/i)
    ).toBeInTheDocument();
  });
});
