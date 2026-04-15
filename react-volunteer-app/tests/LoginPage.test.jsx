import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "../src/pages/LoginPage";

const mockNavigate = vi.fn();
const mockLoginUser = vi.fn();
const mockSaveToken = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../src/api", async () => {
  const actual = await vi.importActual("../src/api");
  return {
    ...actual,
    loginUser: (...args) => mockLoginUser(...args),
    saveToken: (...args) => mockSaveToken(...args),
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
      <LoginPage />
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders form fields", () => {
    renderPage();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^пароль$/i)).toBeInTheDocument();
  });

  it("allows typing", () => {
    renderPage();

    const email = screen.getByLabelText(/email/i);
    const password = screen.getByLabelText(/^пароль$/i);

    fireEvent.change(email, { target: { value: "test@mail.com" } });
    fireEvent.change(password, { target: { value: "12345678" } });

    expect(email.value).toBe("test@mail.com");
    expect(password.value).toBe("12345678");
  });

  it("renders submit button", () => {
    renderPage();

    expect(screen.getByRole("button", { name: /^войти$/i })).toBeInTheDocument();
  });

  it("renders link to register page", () => {
    renderPage();

    expect(
      screen.getByRole("link", { name: /зарегистрироваться/i })
    ).toBeInTheDocument();
  });

  it("submits form, saves token and navigates to profile", async () => {
    mockLoginUser.mockResolvedValue({
      token: "test-token",
      user: {
        id: 25,
      },
    });

    renderPage();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@mail.com" },
    });
    fireEvent.change(screen.getByLabelText(/^пароль$/i), {
      target: { value: "12345678" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^войти$/i }));

    await waitFor(() => {
      expect(mockLoginUser).toHaveBeenCalledWith({
        email: "test@mail.com",
        password: "12345678",
      });
    });

    expect(mockSaveToken).toHaveBeenCalledWith("test-token");
    expect(mockNavigate).toHaveBeenCalledWith("/profiles/25");
  });

  it("shows server id error when user id is missing", async () => {
    mockLoginUser.mockResolvedValue({
      token: "test-token",
      user: {},
    });

    renderPage();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@mail.com" },
    });
    fireEvent.change(screen.getByLabelText(/^пароль$/i), {
      target: { value: "12345678" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^войти$/i }));

    expect(
      await screen.findByText(/сервер не вернул id пользователя/i)
    ).toBeInTheDocument();

    expect(mockSaveToken).toHaveBeenCalledWith("test-token");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows request error from api", async () => {
    mockLoginUser.mockRejectedValue(new Error("Неверный логин или пароль"));

    renderPage();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@mail.com" },
    });
    fireEvent.change(screen.getByLabelText(/^пароль$/i), {
      target: { value: "wrong-password" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^войти$/i }));

    expect(
      await screen.findByText(/неверный логин или пароль/i)
    ).toBeInTheDocument();

    expect(mockSaveToken).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows fallback error when api throws without message", async () => {
    mockLoginUser.mockRejectedValue({});

    renderPage();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@mail.com" },
    });
    fireEvent.change(screen.getByLabelText(/^пароль$/i), {
      target: { value: "wrong-password" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^войти$/i }));

    expect(
      await screen.findByText(/не удалось выполнить вход/i)
    ).toBeInTheDocument();
  });

  it("shows loading state while submitting", async () => {
    let resolveLogin;
    mockLoginUser.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        })
    );

    renderPage();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@mail.com" },
    });
    fireEvent.change(screen.getByLabelText(/^пароль$/i), {
      target: { value: "12345678" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^войти$/i }));

    expect(screen.getByRole("button", { name: /входим/i })).toBeDisabled();

    resolveLogin({
      token: "test-token",
      user: { id: 42 },
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/profiles/42");
    });
  });

  it("does not save token when token is missing", async () => {
    mockLoginUser.mockResolvedValue({
      user: { id: 77 },
    });

    renderPage();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@mail.com" },
    });
    fireEvent.change(screen.getByLabelText(/^пароль$/i), {
      target: { value: "12345678" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^войти$/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/profiles/77");
    });

    expect(mockSaveToken).not.toHaveBeenCalled();
  });
});