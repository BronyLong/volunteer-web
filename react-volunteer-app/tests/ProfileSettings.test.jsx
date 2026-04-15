import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProfileSettings from "../src/pages/ProfileSettings";

const mockGetMyProfile = vi.fn();
const mockGetUserIdFromToken = vi.fn();
const mockUpdateMyProfile = vi.fn();
const mockNavigate = vi.fn();

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
    getMyProfile: (...args) => mockGetMyProfile(...args),
    getUserIdFromToken: (...args) => mockGetUserIdFromToken(...args),
    updateMyProfile: (...args) => mockUpdateMyProfile(...args),
  };
});

function renderPage(route = "/profiles/5/settings") {
  return render(
    <MemoryRouter
      initialEntries={[route]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/profiles/:id/settings" element={<ProfileSettings />} />
      </Routes>
    </MemoryRouter>
  );
}

function clickSave() {
  const saveButtons = screen.getAllByRole("button", { name: /сохранить/i });
  fireEvent.click(saveButtons[0]);
}

const validProfile = {
  id: 5,
  first_name: "Анна",
  last_name: "Иванова",
  email: "anna@example.com",
  phone: "+7 (999) 000-11-22",
  city: "Москва",
  bio: "Организую мероприятия",
  social_vk: "https://vk.com/anna",
  social_ok: "https://ok.ru/profile/anna",
  social_max: "https://max.ru/anna",
};

describe("ProfileSettings", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mockGetUserIdFromToken.mockReturnValue(5);
    mockGetMyProfile.mockResolvedValue(validProfile);
    mockUpdateMyProfile.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects to login when user is not authorized", async () => {
    mockGetUserIdFromToken.mockReturnValue(null);

    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    });
  });

  it("redirects to profile page when user is not the owner", async () => {
    mockGetUserIdFromToken.mockReturnValue(99);

    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/profiles/5", { replace: true });
    });
  });

  it("loads profile data for owner", async () => {
    renderPage();

    expect(await screen.findByDisplayValue("Анна")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Иванова")).toBeInTheDocument();
    expect(screen.getByDisplayValue("anna@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("+7 (999) 000-11-22")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Москва")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Организую мероприятия")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://vk.com/anna")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://ok.ru/profile/anna")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://max.ru/anna")).toBeInTheDocument();
  });

  it("shows loading error when profile request fails", async () => {
    mockGetMyProfile.mockRejectedValueOnce(
      new Error("Не удалось загрузить настройки профиля")
    );

    renderPage();

    expect(
      await screen.findByText(/не удалось загрузить настройки профиля/i)
    ).toBeInTheDocument();
  });

  it("shows fallback loading error when profile request fails without message", async () => {
    mockGetMyProfile.mockRejectedValueOnce({});

    renderPage();

    expect(
      await screen.findByText(/не удалось загрузить настройки профиля/i)
    ).toBeInTheDocument();
  });

  it("shows validation error when required fields are invalid", async () => {
    mockGetMyProfile.mockResolvedValueOnce({
      ...validProfile,
      first_name: "",
      last_name: "",
    });

    renderPage();

    await screen.findByLabelText(/email/i);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "bad-email" },
    });
    fireEvent.change(screen.getByLabelText(/телефон/i), {
      target: { value: "+7 (123)" },
    });
    fireEvent.change(screen.getByLabelText(/вконтакте/i), {
      target: { value: "bad-vk" },
    });
    fireEvent.change(screen.getByLabelText(/одноклассники/i), {
      target: { value: "bad-ok" },
    });
    fireEvent.change(screen.getByLabelText(/^max$/i), {
      target: { value: "bad-max" },
    });

    clickSave();

    await waitFor(() => {
      expect(mockUpdateMyProfile).not.toHaveBeenCalled();
    });
  });

  it("clears success message after changing any field", async () => {
    renderPage();

    await screen.findByDisplayValue("Анна");

    fireEvent.change(screen.getByLabelText(/телефон/i), {
      target: { value: "89990001122" },
    });

    clickSave();

    expect(await screen.findByText(/изменения сохранены/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/город/i), {
      target: { value: "Тверь" },
    });

    expect(screen.queryByText(/изменения сохранены/i)).not.toBeInTheDocument();
  });

  it("formats phone while typing", async () => {
    renderPage();

    await screen.findByDisplayValue("Анна");

    const phoneInput = screen.getByLabelText(/телефон/i);

    fireEvent.change(phoneInput, {
      target: { value: "89991234567" },
    });

    expect(phoneInput.value).toBe("+7 (999) 123-45-67");
  });

  it("saves valid form and shows success message", async () => {
    renderPage();
  
    await screen.findByDisplayValue("Анна");
  
    fireEvent.change(screen.getByLabelText(/имя/i), {
      target: { value: "Мария" },
    });
    fireEvent.change(screen.getByLabelText(/фамилия/i), {
      target: { value: "Петрова" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "NEW@MAIL.RU" },
    });
    fireEvent.change(screen.getByLabelText(/телефон/i), {
      target: { value: "89991234567" },
    });
    fireEvent.change(screen.getByLabelText(/город/i), {
      target: { value: "Казань" },
    });
    fireEvent.change(screen.getByLabelText(/bio/i), {
      target: { value: "Новый bio" },
    });
    fireEvent.change(screen.getByLabelText(/вконтакте/i), {
      target: { value: "https://vk.com/new" },
    });
    fireEvent.change(screen.getByLabelText(/одноклассники/i), {
      target: { value: "https://ok.ru/profile/new" },
    });
    fireEvent.change(screen.getByLabelText(/^max$/i), {
      target: { value: "https://max.ru/new" },
    });
  
    clickSave();
  
    await waitFor(() => {
      expect(mockUpdateMyProfile).toHaveBeenCalledTimes(1);
    });
  
    expect(mockUpdateMyProfile).toHaveBeenCalledWith({
      first_name: "Мария",
      last_name: "Петрова",
      email: "new@mail.ru",
      phone: "+7 (999) 123-45-67",
      city: "Казань",
      bio: "Новый bio",
      social_vk: "https://vk.com/new",
      social_ok: "https://ok.ru/profile/new",
      social_max: "https://max.ru/new",
      avatar_url: "",
    });
  
    expect(await screen.findByText(/изменения сохранены/i)).toBeInTheDocument();
  });
  
  it("shows update error from api", async () => {
    mockUpdateMyProfile.mockRejectedValueOnce(
      new Error("Не удалось сохранить изменения")
    );

    renderPage();

    await screen.findByDisplayValue("Анна");

    fireEvent.change(screen.getByLabelText(/телефон/i), {
      target: { value: "89991234567" },
    });

    clickSave();

    expect(
      await screen.findByText(/не удалось сохранить изменения/i)
    ).toBeInTheDocument();
  });

  it("shows fallback update error when api throws without message", async () => {
    mockUpdateMyProfile.mockRejectedValueOnce({});

    renderPage();

    await screen.findByDisplayValue("Анна");

    fireEvent.change(screen.getByLabelText(/телефон/i), {
      target: { value: "89991234567" },
    });

    clickSave();

    expect(
      await screen.findByText(/не удалось сохранить изменения/i)
    ).toBeInTheDocument();
  });

  it("shows top-level validation message for invalid form", async () => {
    renderPage();
  
    await screen.findByDisplayValue("Анна");
  
    fireEvent.change(screen.getByLabelText(/имя/i), {
      target: { value: "" },
    });
  
    clickSave();
  
    expect(
      await screen.findByText(/исправьте ошибки в форме/i)
    ).toBeInTheDocument();
  
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
  });

  it('shows "Пользователь" when first and last name are empty', async () => {
    mockGetMyProfile.mockResolvedValueOnce({
      id: 5,
      role: "volunteer",
      first_name: "",
      last_name: "",
      email: "anna@example.com",
      phone: "",
      city: "",
      avatar_url: "",
      bio: "",
      social_vk: "",
      social_ok: "",
      social_max: "",
    });
  
    renderPage();
  
    expect(
      await screen.findByRole("heading", { name: "Пользователь" })
    ).toBeInTheDocument();
  });

  it("clears top error after changing a field", async () => {
    renderPage();
  
    await screen.findByDisplayValue("Анна");
  
    fireEvent.change(screen.getByLabelText(/имя/i), {
      target: { value: "" },
    });
  
    clickSave();
  
    expect(
      await screen.findByText(/исправьте ошибки в форме/i)
    ).toBeInTheDocument();
  
    fireEvent.change(screen.getByLabelText(/имя/i), {
      target: { value: "Анна" },
    });
  
    expect(
      screen.queryByText(/исправьте ошибки в форме/i)
    ).not.toBeInTheDocument();
  });

  it("shows validation errors for invalid social links", async () => {
    renderPage();
  
    await screen.findByDisplayValue("Анна");
  
    fireEvent.change(screen.getByLabelText(/вконтакте/i), {
      target: { value: "bad-link" },
    });
  
    fireEvent.change(screen.getByLabelText(/одноклассники/i), {
      target: { value: "bad-link" },
    });
  
    fireEvent.change(screen.getByLabelText(/^max$/i), {
      target: { value: "bad-link" },
    });
  
    clickSave();
  
    expect(
      await screen.findByText(/укажите корректную ссылку vk/i)
    ).toBeInTheDocument();
  
    expect(
      screen.getByText(/укажите корректную ссылку одноклассников/i)
    ).toBeInTheDocument();
  
    expect(
      screen.getByText(/укажите корректную ссылку max/i)
    ).toBeInTheDocument();
  });
});