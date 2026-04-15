import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RegisterPage from "../src/pages/RegisterPage";

const mockNavigate = vi.fn();
const mockRegisterUser = vi.fn();
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
    registerUser: (...args) => mockRegisterUser(...args),
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
      <RegisterPage />
    </MemoryRouter>
  );
}

function fillForm({
  firstName = "Иван",
  lastName = "Иванов",
  email = "ivan@test.ru",
  password = "Password123!",
  confirmPassword = "Password123!",
} = {}) {
  fireEvent.change(screen.getByLabelText(/имя/i), {
    target: { value: firstName },
  });
  fireEvent.change(screen.getByLabelText(/фамилия/i), {
    target: { value: lastName },
  });
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText(/^пароль$/i), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText(/подтверждение пароля/i), {
    target: { value: confirmPassword },
  });
}

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders registration form fields", () => {
    renderPage();

    expect(screen.getByLabelText(/имя/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/фамилия/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^пароль$/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/подтверждение пароля/i)
    ).toBeInTheDocument();
  });

  it("allows typing into fields", () => {
    renderPage();

    fillForm();

    expect(screen.getByLabelText(/имя/i).value).toBe("Иван");
    expect(screen.getByLabelText(/фамилия/i).value).toBe("Иванов");
    expect(screen.getByLabelText(/email/i).value).toBe("ivan@test.ru");
    expect(screen.getByLabelText(/^пароль$/i).value).toBe("Password123!");
    expect(screen.getByLabelText(/подтверждение пароля/i).value).toBe("Password123!");
  });

  it("renders submit button", () => {
    renderPage();

    expect(
      screen.getByRole("button", { name: /создать аккаунт/i })
    ).toBeInTheDocument();
  });

  it("renders link to login page", () => {
    renderPage();

    expect(screen.getByRole("link", { name: /^войти$/i })).toBeInTheDocument();
  });

  it("shows password mismatch error", async () => {
    renderPage();

    fillForm({
      password: "Password123!",
      confirmPassword: "OtherPassword123!",
    });

    fireEvent.click(screen.getByRole("button", { name: /создать аккаунт/i }));

    expect(await screen.findByText(/пароли не совпадают/i)).toBeInTheDocument();
    expect(mockRegisterUser).not.toHaveBeenCalled();
  });

  it("submits form, saves token and navigates to profile", async () => {
    mockRegisterUser.mockResolvedValue({
      token: "reg-token",
      user: {
        id: 31,
      },
    });

    renderPage();

    fillForm();

    fireEvent.click(screen.getByRole("button", { name: /создать аккаунт/i }));

    await waitFor(() => {
      expect(mockRegisterUser).toHaveBeenCalledWith({
        firstName: "Иван",
        lastName: "Иванов",
        email: "ivan@test.ru",
        password: "Password123!",
      });
    });

    expect(mockSaveToken).toHaveBeenCalledWith("reg-token");
    expect(mockNavigate).toHaveBeenCalledWith("/profiles/31");
  });

  it("navigates to login when user id is missing", async () => {
    mockRegisterUser.mockResolvedValue({
      token: "reg-token",
      user: {},
    });

    renderPage();

    fillForm();

    fireEvent.click(screen.getByRole("button", { name: /создать аккаунт/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });

    expect(mockSaveToken).toHaveBeenCalledWith("reg-token");
  });

  it("does not save token when token is missing", async () => {
    mockRegisterUser.mockResolvedValue({
      user: { id: 55 },
    });

    renderPage();

    fillForm();

    fireEvent.click(screen.getByRole("button", { name: /создать аккаунт/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/profiles/55");
    });

    expect(mockSaveToken).not.toHaveBeenCalled();
  });

  it("shows request error from api", async () => {
    mockRegisterUser.mockRejectedValue(new Error("Такой email уже используется"));

    renderPage();

    fillForm();

    fireEvent.click(screen.getByRole("button", { name: /создать аккаунт/i }));

    expect(
      await screen.findByText(/такой email уже используется/i)
    ).toBeInTheDocument();

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows fallback error when api throws without message", async () => {
    mockRegisterUser.mockRejectedValue({});

    renderPage();

    fillForm();

    fireEvent.click(screen.getByRole("button", { name: /создать аккаунт/i }));

    expect(
      await screen.findByText(/не удалось выполнить регистрацию/i)
    ).toBeInTheDocument();
  });

  it("shows loading state while submitting", async () => {
    let resolveRegister;
    mockRegisterUser.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRegister = resolve;
        })
    );

    renderPage();

    fillForm();

    fireEvent.click(screen.getByRole("button", { name: /создать аккаунт/i }));

    expect(
      screen.getByRole("button", { name: /создаем аккаунт/i })
    ).toBeDisabled();

    resolveRegister({
      token: "reg-token",
      user: { id: 90 },
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/profiles/90");
    });
  });
});