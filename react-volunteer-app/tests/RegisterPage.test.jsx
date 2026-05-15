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
  middleName = "Иванович",
  gender = "male",
  email = "ivan@test.ru",
  password = "Password123!",
  confirmPassword = "Password123!",
  consent = true,
} = {}) {
  fireEvent.change(screen.getByLabelText(/имя/i), {
    target: { value: firstName },
  });
  fireEvent.change(screen.getByLabelText(/фамилия/i), {
    target: { value: lastName },
  });
  fireEvent.change(screen.getByLabelText(/отчество/i), {
    target: { value: middleName },
  });
  fireEvent.change(screen.getByLabelText(/^пол$/i), {
    target: { value: gender },
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

  if (consent) {
    fireEvent.click(screen.getByRole("checkbox", { name: /персональных данных/i }));
  }
}

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders registration form fields", () => {
    renderPage();

    expect(screen.getByLabelText(/имя/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/фамилия/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/отчество/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^пол$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^пароль$/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/подтверждение пароля/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /персональных данных/i })
    ).toBeInTheDocument();
  });

  it("allows typing into fields", () => {
    renderPage();

    fillForm({ gender: "female" });

    expect(screen.getByLabelText(/имя/i).value).toBe("Иван");
    expect(screen.getByLabelText(/фамилия/i).value).toBe("Иванов");
    expect(screen.getByLabelText(/отчество/i).value).toBe("Иванович");
    expect(screen.getByLabelText(/^пол$/i).value).toBe("female");
    expect(screen.getByLabelText(/email/i).value).toBe("ivan@test.ru");
    expect(screen.getByLabelText(/^пароль$/i).value).toBe("Password123!");
    expect(screen.getByLabelText(/подтверждение пароля/i).value).toBe("Password123!");
    expect(
      screen.getByRole("checkbox", { name: /персональных данных/i })
    ).toBeChecked();
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

  it("does not submit form without personal data consent", () => {
    renderPage();

    fillForm({ consent: false });

    fireEvent.click(screen.getByRole("button", { name: /создать аккаунт/i }));

    expect(mockRegisterUser).not.toHaveBeenCalled();
  });

  it("submits form and shows email confirmation message from api", async () => {
    mockRegisterUser.mockResolvedValue({
      message: "Проверьте почту для подтверждения аккаунта",
    });

    renderPage();

    fillForm();

    fireEvent.click(screen.getByRole("button", { name: /создать аккаунт/i }));

    await waitFor(() => {
      expect(mockRegisterUser).toHaveBeenCalledWith({
        firstName: "Иван",
        lastName: "Иванов",
        middleName: "Иванович",
        gender: "male",
        email: "ivan@test.ru",
        password: "Password123!",
        personalDataConsent: true,
      });
    });

    expect(mockSaveToken).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/проверьте почту для подтверждения аккаунта/i)
    ).toBeInTheDocument();
  });

  it("shows fallback success message when api response has no message", async () => {
    mockRegisterUser.mockResolvedValue({});

    renderPage();

    fillForm();

    fireEvent.click(screen.getByRole("button", { name: /создать аккаунт/i }));

    expect(
      await screen.findByText(/регистрация почти завершена/i)
    ).toBeInTheDocument();

    expect(screen.getByLabelText(/имя/i).value).toBe("");
    expect(screen.getByLabelText(/фамилия/i).value).toBe("");
    expect(screen.getByLabelText(/отчество/i).value).toBe("");
    expect(screen.getByLabelText(/^пол$/i).value).toBe("male");
    expect(screen.getByLabelText(/email/i).value).toBe("");
    expect(screen.getByLabelText(/^пароль$/i).value).toBe("");
    expect(screen.getByLabelText(/подтверждение пароля/i).value).toBe("");
    expect(
      screen.getByRole("checkbox", { name: /персональных данных/i })
    ).not.toBeChecked();
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
      message: "Проверьте почту для подтверждения аккаунта",
    });

    expect(
      await screen.findByText(/проверьте почту для подтверждения аккаунта/i)
    ).toBeInTheDocument();
  });
});
