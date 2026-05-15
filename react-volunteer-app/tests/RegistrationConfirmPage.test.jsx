import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RegistrationConfirmPage from "../src/pages/RegistrationConfirmPage";

const mockConfirmRegistration = vi.fn();

vi.mock("../src/api", async () => {
  const actual = await vi.importActual("../src/api");
  return {
    ...actual,
    confirmRegistration: (...args) => mockConfirmRegistration(...args),
  };
});

function renderPage(initialEntry = "/registration-confirm?token=confirm-token") {
  return render(
    <MemoryRouter
      initialEntries={[initialEntry]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <RegistrationConfirmPage />
    </MemoryRouter>
  );
}

describe("RegistrationConfirmPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("confirms registration and shows server message", async () => {
    mockConfirmRegistration.mockResolvedValue({ message: "Аккаунт подтвержден" });

    renderPage();

    expect(screen.getByText(/подтверждаем регистрацию/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockConfirmRegistration).toHaveBeenCalledWith("confirm-token");
    });

    expect(await screen.findByText("Аккаунт подтвержден")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /перейти ко входу/i })).toHaveAttribute("href", "/login");
  });

  it("shows fallback success message", async () => {
    mockConfirmRegistration.mockResolvedValue({});

    renderPage();

    expect(await screen.findByText(/регистрация подтверждена. теперь вы можете войти/i)).toBeInTheDocument();
  });

  it("shows error when token is missing", async () => {
    renderPage("/registration-confirm");

    expect(await screen.findByText(/ссылка подтверждения некорректна/i)).toBeInTheDocument();
    expect(mockConfirmRegistration).not.toHaveBeenCalled();
  });

  it("shows request and fallback errors", async () => {
    mockConfirmRegistration.mockRejectedValueOnce(new Error("Ссылка истекла"));

    const { unmount } = renderPage();

    expect(await screen.findByText("Ссылка истекла")).toBeInTheDocument();

    unmount();
    vi.clearAllMocks();
    mockConfirmRegistration.mockRejectedValueOnce({});

    renderPage();

    expect(await screen.findByText(/не удалось подтвердить регистрацию/i)).toBeInTheDocument();
  });
});
