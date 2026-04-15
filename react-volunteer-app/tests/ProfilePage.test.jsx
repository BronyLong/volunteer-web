import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../src/pages/ProfilePage";

const mockGetProfileById = vi.fn();
const mockUpdateMyProfile = vi.fn();

vi.mock("../src/api", async () => {
  const actual = await vi.importActual("../src/api");
  return {
    ...actual,
    getProfileById: (...args) => mockGetProfileById(...args),
    updateMyProfile: (...args) => mockUpdateMyProfile(...args),
  };
});

vi.mock("../src/components/ProfileEventCard", () => ({
  default: ({ title, location, date, link, buttonText }) => (
    <div data-testid="profile-event-card">
      <div>{title}</div>
      <div>{location}</div>
      <div>{date}</div>
      <a href={link}>{buttonText}</a>
    </div>
  ),
}));

function renderPage(route = "/profiles/5") {
  return render(
    <MemoryRouter
      initialEntries={[route]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/profiles/:id" element={<ProfilePage />} />
        <Route path="/profiles/:id/settings" element={<div>Settings page</div>} />
        <Route path="/create" element={<div>Create page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const ownerCoordinatorProfile = {
  id: 5,
  first_name: "Анна",
  last_name: "Иванова",
  role: "coordinator",
  access_level: "private",
  is_owner: true,
  can_view_contacts: true,
  phone: "+79990001122",
  email: "anna@example.com",
  city: "Москва",
  bio: "Организую волонтерские мероприятия",
  social_vk: "vk.com/anna",
  social_ok: "ok.ru/profile/anna",
  social_max: "max.ru/anna",
  avatar_url: "data:image/jpeg;base64,old-avatar",
  coordinator_events: [
    {
      id: 101,
      title: "Субботник",
      location: "Парк Победы",
      start_at: "2099-05-10T10:30:00.000Z",
    },
    {
      id: 102,
      title: "Помощь приюту",
      location: "Приют",
      start_at: "2099-06-15T11:00:00.000Z",
    },
  ],
};

const publicVolunteerProfile = {
  id: 8,
  first_name: "Иван",
  last_name: "Петров",
  role: "volunteer",
  access_level: "public",
  is_owner: false,
  can_view_contacts: false,
  phone: "+79990000001",
  email: "ivan@example.com",
  city: "Казань",
  bio: "",
  social_vk: "vk.com/ivan",
  social_ok: "",
  social_max: "",
  avatar_url: "",
  volunteer_events: [
    {
      id: 201,
      title: "Сбор вещей",
      location: "Штаб",
      start_at: "2099-07-20T09:00:00.000Z",
    },
  ],
};

const publicCoordinatorProfile = {
  id: 12,
  first_name: "Мария",
  last_name: "Соколова",
  role: "coordinator",
  access_level: "public",
  is_owner: false,
  can_view_contacts: false,
  phone: "+79991112233",
  email: "maria@example.com",
  city: "Самара",
  bio: "Координатор мероприятий",
  social_vk: "",
  social_ok: "",
  social_max: "",
  avatar_url: "",
  coordinator_events: [],
};

function mockCanvasSuccess(dataUrl = "data:image/jpeg;base64,new-avatar") {
  const originalCreateElement = document.createElement.bind(document);

  vi.spyOn(document, "createElement").mockImplementation((tagName) => {
    if (tagName === "canvas") {
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: vi.fn(),
        }),
        toDataURL: () => dataUrl,
      };
    }

    return originalCreateElement(tagName);
  });

  class FileReaderMock {
    constructor() {
      this.result = "data:image/png;base64,file";
      this.onload = null;
      this.onerror = null;
    }

    readAsDataURL() {
      if (this.onload) {
        this.onload();
      }
    }
  }

  class ImageMock {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this.width = 1200;
      this.height = 800;
    }

    set src(_) {
      if (this.onload) {
        this.onload();
      }
    }
  }

  vi.stubGlobal("FileReader", FileReaderMock);
  vi.stubGlobal("Image", ImageMock);
}

function mockCanvasImageError() {
  class FileReaderMock {
    constructor() {
      this.result = "data:image/png;base64,file";
      this.onload = null;
      this.onerror = null;
    }

    readAsDataURL() {
      if (this.onload) {
        this.onload();
      }
    }
  }

  class ImageMock {
    constructor() {
      this.onload = null;
      this.onerror = null;
    }

    set src(_) {
      if (this.onerror) {
        this.onerror();
      }
    }
  }

  vi.stubGlobal("FileReader", FileReaderMock);
  vi.stubGlobal("Image", ImageMock);
}

function mockCanvasContextError() {
  const originalCreateElement = document.createElement.bind(document);

  vi.spyOn(document, "createElement").mockImplementation((tagName) => {
    if (tagName === "canvas") {
      return {
        width: 0,
        height: 0,
        getContext: () => null,
        toDataURL: () => "data:image/jpeg;base64,never-used",
      };
    }

    return originalCreateElement(tagName);
  });

  class FileReaderMock {
    constructor() {
      this.result = "data:image/png;base64,file";
      this.onload = null;
      this.onerror = null;
    }

    readAsDataURL() {
      this.onload?.();
    }
  }

  class ImageMock {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this.width = 1200;
      this.height = 800;
    }

    set src(_) {
      this.onload?.();
    }
  }

  vi.stubGlobal("FileReader", FileReaderMock);
  vi.stubGlobal("Image", ImageMock);
}

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mockUpdateMyProfile.mockResolvedValue({ success: true });
  });

  it("shows loading state", () => {
    mockGetProfileById.mockImplementation(() => new Promise(() => {}));

    renderPage();

    expect(screen.getByText(/загрузка профиля/i)).toBeInTheDocument();
  });

  it("shows profile loading error", async () => {
    mockGetProfileById.mockRejectedValue(new Error("Не удалось загрузить профиль"));

    renderPage();

    expect(
      await screen.findByText(/не удалось загрузить профиль/i)
    ).toBeInTheDocument();
  });

  it("shows not found state when profile is null", async () => {
    mockGetProfileById.mockResolvedValue(null);

    renderPage();

    expect(await screen.findByText(/профиль не найден/i)).toBeInTheDocument();
  });

  it("renders owner coordinator profile with contacts, socials and edit links", async () => {
    mockGetProfileById.mockResolvedValue(ownerCoordinatorProfile);

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Анна Иванова" })
    ).toBeInTheDocument();
    expect(screen.getByText("Координатор")).toBeInTheDocument();
    expect(
      screen.getByText(
        /это ваш приватный профиль\. здесь доступны редактирование и все контактные данные/i
      )
    ).toBeInTheDocument();

    expect(screen.getByText("+79990001122")).toBeInTheDocument();
    expect(screen.getByText("anna@example.com")).toBeInTheDocument();
    expect(screen.getByText("Москва")).toBeInTheDocument();
    expect(
      screen.getByText("Организую волонтерские мероприятия")
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "VK" })).toHaveAttribute(
      "href",
      "https://vk.com/anna"
    );
    expect(screen.getByRole("link", { name: "Одноклассники" })).toHaveAttribute(
      "href",
      "https://ok.ru/profile/anna"
    );
    expect(screen.getByRole("link", { name: "MAX" })).toHaveAttribute(
      "href",
      "https://max.ru/anna"
    );

    expect(
      screen.getByRole("heading", { name: /мои мероприятия/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /добавить мероприятие/i })
    ).toHaveAttribute("href", "/create");

    const editLinks = screen.getAllByRole("link", { name: /изменить/i });
    expect(editLinks).toHaveLength(2);
    expect(editLinks[0]).toHaveAttribute("href", "/profiles/5/settings");

    const cards = screen.getAllByTestId("profile-event-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByText("Субботник")).toBeInTheDocument();
    expect(screen.getByText("Помощь приюту")).toBeInTheDocument();
  });

  it("renders public volunteer profile with hidden contacts and hidden socials", async () => {
    mockGetProfileById.mockResolvedValue(publicVolunteerProfile);

    renderPage("/profiles/8");

    expect(
      await screen.findByRole("heading", { name: "Иван Петров" })
    ).toBeInTheDocument();
    expect(screen.getByText("Волонтер")).toBeInTheDocument();
    expect(screen.getByText(/контактные данные скрыты\./i)).toBeInTheDocument();

    expect(screen.getAllByText("Контактные данные скрыты")).toHaveLength(3);
    expect(screen.getByText("Пока не заполнено")).toBeInTheDocument();
    expect(screen.getByText("Социальные сети скрыты")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /мероприятия пользователя/i })
    ).toBeInTheDocument();

    expect(screen.getByText("Сбор вещей")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /добавить мероприятие/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /изменить/i })).not.toBeInTheDocument();
  });

  it("shows coordinator public access message and hidden contact placeholders", async () => {
    mockGetProfileById.mockResolvedValue(publicCoordinatorProfile);

    renderPage("/profiles/12");

    expect(
      await screen.findByRole("heading", { name: "Мария Соколова" })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /контактные данные скрыты\. доступ появится после участия в мероприятии этого координатора/i
      )
    ).toBeInTheDocument();

    expect(screen.getAllByText("Контактные данные скрыты")).toHaveLength(3);
    expect(screen.getByText("Социальные сети скрыты")).toBeInTheDocument();
    expect(screen.getByText(/здесь пока нет мероприятий/i)).toBeInTheDocument();
  });

  it("renders visible volunteer contacts and volunteer events title for owner", async () => {
    mockGetProfileById.mockResolvedValue({
      ...publicVolunteerProfile,
      id: 9,
      is_owner: true,
      can_view_contacts: true,
      access_level: "contact",
      bio: "Помогаю на мероприятиях",
    });

    renderPage("/profiles/9");

    expect(
      await screen.findByRole("heading", { name: "Иван Петров" })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /мероприятия, в которых я участвую/i })
    ).toBeInTheDocument();

    expect(screen.getByText("Контактные данные доступны.")).toBeInTheDocument();
    expect(screen.getByText("+79990000001")).toBeInTheDocument();
    expect(screen.getByText("ivan@example.com")).toBeInTheDocument();
    expect(screen.getByText("Казань")).toBeInTheDocument();
    expect(screen.getByText("Помогаю на мероприятиях")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "VK" })).toHaveAttribute(
      "href",
      "https://vk.com/ivan"
    );
  });

  it("shows fallback values for unknown role, invalid date and unknown access level", async () => {
    mockGetProfileById.mockResolvedValue({
      id: 99,
      first_name: "   ",
      last_name: "",
      role: "mystery",
      access_level: "strange",
      is_owner: false,
      can_view_contacts: true,
      phone: "",
      email: "   ",
      city: null,
      bio: "",
      social_vk: "https://vk.com/custom-user",
      social_ok: "",
      social_max: "",
      avatar_url: "",
      volunteer_events: [
        {
          id: 777,
          title: "Странное мероприятие",
          location: "",
          start_at: "not-a-date",
        },
      ],
    });
  
    renderPage("/profiles/99");
  
    expect(
      await screen.findByRole("heading", { name: "Пользователь" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("Пользователь")).toHaveLength(2);
  
    expect(screen.getAllByText("Не указано")).toHaveLength(4);
    expect(screen.getByText("Пока не заполнено")).toBeInTheDocument();
  
    expect(
      screen.getByRole("heading", { name: /мероприятия пользователя/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Дата не указана")).toBeInTheDocument();
  
    expect(screen.getByRole("link", { name: "VK" })).toHaveAttribute(
      "href",
      "https://vk.com/custom-user"
    );
  });

  it("shows empty events state when profile has no events", async () => {
    mockGetProfileById.mockResolvedValue({
      ...ownerCoordinatorProfile,
      coordinator_events: [],
      social_vk: "",
      social_ok: "",
      social_max: "",
    });

    renderPage();

    expect(
      await screen.findByText(/здесь пока нет мероприятий/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/социальные сети не указаны/i)).toBeInTheDocument();
  });

  it("clicking editable avatar triggers hidden file input click", async () => {
    mockGetProfileById.mockResolvedValue(ownerCoordinatorProfile);

    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});

    renderPage();

    const avatarButton = await screen.findByRole("button", {
      name: /изменить аватар пользователя/i,
    });

    fireEvent.click(avatarButton);

    expect(clickSpy).toHaveBeenCalled();
  });

  it("pressing Enter and Space on editable avatar triggers hidden file input click", async () => {
    mockGetProfileById.mockResolvedValue(ownerCoordinatorProfile);

    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});

    renderPage();

    const avatarButton = await screen.findByRole("button", {
      name: /изменить аватар пользователя/i,
    });

    fireEvent.keyDown(avatarButton, { key: "Enter" });
    fireEvent.keyDown(avatarButton, { key: " " });

    expect(clickSpy).toHaveBeenCalledTimes(2);
  });

  it("uploads avatar successfully and updates preview", async () => {
    mockGetProfileById.mockResolvedValue(ownerCoordinatorProfile);
    mockCanvasSuccess("data:image/jpeg;base64,new-avatar");

    const { container } = renderPage();

    await screen.findByRole("heading", { name: "Анна Иванова" });

    const fileInput = container.querySelector('input[type="file"]');
    const goodFile = new File(["img"], "avatar.png", { type: "image/png" });

    fireEvent.change(fileInput, {
      target: { files: [goodFile] },
    });

    await waitFor(() => {
      expect(mockUpdateMyProfile).toHaveBeenCalledWith({
        first_name: "Анна",
        last_name: "Иванова",
        email: "anna@example.com",
        phone: "+79990001122",
        city: "Москва",
        avatar_url: "data:image/jpeg;base64,new-avatar",
        bio: "Организую волонтерские мероприятия",
        social_vk: "vk.com/anna",
        social_ok: "ok.ru/profile/anna",
        social_max: "max.ru/anna",
      });
    });

    const avatars = screen.getAllByAltText(/аватар пользователя/i);
    expect(avatars[0]).toHaveAttribute("src", "data:image/jpeg;base64,new-avatar");
  });

  it("shows file type error for non-image avatar upload", async () => {
    mockGetProfileById.mockResolvedValue(ownerCoordinatorProfile);

    const { container } = renderPage();

    await screen.findByRole("heading", { name: "Анна Иванова" });

    const fileInput = container.querySelector('input[type="file"]');
    const badFile = new File(["text"], "file.txt", { type: "text/plain" });

    fireEvent.change(fileInput, {
      target: { files: [badFile] },
    });

    expect(await screen.findByText(/выберите изображение/i)).toBeInTheDocument();
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
  });

  it("shows image loading error when image processing fails", async () => {
    mockGetProfileById.mockResolvedValue(ownerCoordinatorProfile);
    mockCanvasImageError();

    const { container } = renderPage();

    await screen.findByRole("heading", { name: "Анна Иванова" });

    const fileInput = container.querySelector('input[type="file"]');
    const goodFile = new File(["img"], "avatar.png", { type: "image/png" });

    fireEvent.change(fileInput, {
      target: { files: [goodFile] },
    });

    expect(
      await screen.findByText(/не удалось загрузить изображение/i)
    ).toBeInTheDocument();

    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
  });

  it("shows avatar update fallback error when request fails without message", async () => {
    mockGetProfileById.mockResolvedValue(ownerCoordinatorProfile);
    mockCanvasSuccess("data:image/jpeg;base64:new-avatar");
    mockUpdateMyProfile.mockRejectedValue({});

    const { container } = renderPage();

    await screen.findByRole("heading", { name: "Анна Иванова" });

    const fileInput = container.querySelector('input[type="file"]');
    const goodFile = new File(["img"], "avatar.png", { type: "image/png" });

    fireEvent.change(fileInput, {
      target: { files: [goodFile] },
    });

    expect(
      await screen.findByText(/не удалось обновить аватар/i)
    ).toBeInTheDocument();
  });

  it("does not show add event button for admin owner", async () => {
    mockGetProfileById.mockResolvedValue({
      ...ownerCoordinatorProfile,
      role: "admin",
      coordinator_events: [],
    });

    renderPage();

    expect(await screen.findByText("Администратор")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /добавить мероприятие/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /мои мероприятия/i })
    ).toBeInTheDocument();
  });

  it("shows generic access note class for unknown access level", async () => {
    mockGetProfileById.mockResolvedValueOnce({
      id: 77,
      first_name: "",
      last_name: "",
      role: "mystery",
      access_level: "mystery",
      is_owner: false,
      can_view_contacts: false,
      city: "",
      bio: "",
      volunteer_events: [],
    });
  
    const { container } = renderPage("/profiles/77");
  
    expect(
      await screen.findByRole("heading", { name: "Пользователь" })
    ).toBeInTheDocument();
  
    expect(
      container.querySelector(".profile-summary__access-note")
    ).toBeInTheDocument();
  });
  
  it("shows image processing error when canvas context is unavailable", async () => {
    mockCanvasContextError();
  
    const { container } = renderPage();
  
    await screen.findByText("Анна Иванова");
  
    const input = container.querySelector(".profile-summary__avatar-input");
    expect(input).toBeInTheDocument();
  
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
  
    fireEvent.change(input, {
      target: { files: [file] },
    });
  
    expect(
      await screen.findByText(/не удалось обработать изображение/i)
    ).toBeInTheDocument();
  });

  it("shows loading error state when profile request fails without loaded profile", async () => {
    mockGetProfileById.mockRejectedValueOnce({});
  
    renderPage("/profiles/77");
  
    expect(
      await screen.findByText(/не удалось загрузить профиль/i)
    ).toBeInTheDocument();
  });

  it("normalizes social links without protocol", async () => {
    mockGetProfileById.mockResolvedValueOnce({
      id: 77,
      first_name: "Анна",
      last_name: "Иванова",
      role: "coordinator",
      access_level: "contact",
      is_owner: false,
      can_view_contacts: true,
      email: "anna@example.com",
      phone: "+79990000000",
      city: "Москва",
      bio: "",
      social_ok: "ok.ru/anna",
      social_vk: "vk.com/anna",
      social_max: "max.ru/anna",
      coordinator_events: [],
    });
  
    renderPage("/profiles/77");
  
    expect(await screen.findByLabelText("Одноклассники")).toHaveAttribute(
      "href",
      "https://ok.ru/anna"
    );
    expect(screen.getByLabelText("VK")).toHaveAttribute(
      "href",
      "https://vk.com/anna"
    );
    expect(screen.getByLabelText("MAX")).toHaveAttribute(
      "href",
      "https://max.ru/anna"
    );
  });

  it("does not trigger avatar input click for non-owner profile", async () => {
    const clickSpy = vi.fn();
  
    mockGetProfileById.mockResolvedValueOnce({
      id: 77,
      first_name: "Анна",
      last_name: "Иванова",
      role: "coordinator",
      access_level: "public",
      is_owner: false,
      can_view_contacts: false,
      coordinator_events: [],
    });
  
    const { container } = renderPage("/profiles/77");
  
    await screen.findByText("Анна Иванова");
  
    const input = container.querySelector(".profile-summary__avatar-input");
    input.click = clickSpy;
  
    fireEvent.click(screen.getByRole("img", { name: /аватар пользователя/i }));
  
    expect(clickSpy).not.toHaveBeenCalled();
  });
});