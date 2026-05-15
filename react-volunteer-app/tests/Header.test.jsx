import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Header from "../src/components/Header";

const mockNavigate = vi.fn();
const mockGetToken = vi.fn();
const mockGetMyProfile = vi.fn();
const mockRemoveToken = vi.fn();
const mockGetUnreadNotificationsCount = vi.fn();

let storage = {};

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
    getToken: (...args) => mockGetToken(...args),
    getMyProfile: (...args) => mockGetMyProfile(...args),
    removeToken: (...args) => mockRemoveToken(...args),
    getUnreadNotificationsCount: (...args) => mockGetUnreadNotificationsCount(...args),
  };
});

function makeToken(payload) {
  return `a.${btoa(JSON.stringify(payload))}.c`;
}

Object.defineProperty(window, "localStorage", {
  value: {
    getItem: vi.fn((key) => (key in storage ? storage[key] : null)),
    setItem: vi.fn((key, value) => {
      storage[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      delete storage[key];
    }),
    clear: vi.fn(() => {
      storage = {};
    }),
  },
  configurable: true,
});

function renderHeader({
  route = "/",
  headerProps = {},
  token = null,
  localStorageToken = null,
} = {}) {
  mockGetToken.mockReturnValue(token);

  storage = {};
  if (localStorageToken) {
    storage.token = localStorageToken;
  }

  return render(
    <MemoryRouter
      initialEntries={[route]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Header {...headerProps} />
    </MemoryRouter>
  );
}

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage = {};
    document.body.innerHTML = "";
    mockGetMyProfile.mockResolvedValue({
      id: 1,
      avatar_url: "",
    });
    mockGetUnreadNotificationsCount.mockResolvedValue({ count: 0 });
  });

  it("renders guest navigation links", () => {
    renderHeader();

    expect(
      screen.getAllByRole("link", { name: /хочу помочь/i }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: /регистрация/i }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: /войти/i }).length
    ).toBeGreaterThan(0);
  });

  it("renders logo link", () => {
    renderHeader();

    expect(
      screen.getByRole("link", { name: /логотипрука помощи/i })
    ).toBeInTheDocument();
  });

  it("renders help button", () => {
    renderHeader();

    expect(
      screen.getAllByRole("button", { name: /нужна помощь/i }).length
    ).toBeGreaterThan(0);
  });

  it("opens and closes public help dropdown", () => {
    renderHeader();
  
    const helpButton = screen.getAllByRole("button", { name: /нужна помощь/i })[0];
  
    expect(helpButton).toHaveAttribute("aria-expanded", "false");
  
    fireEvent.click(helpButton);
  
    expect(helpButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/контакты/i)).toBeInTheDocument();
    expect(screen.getByText(/мы в социальных сетях/i)).toBeInTheDocument();
    expect(screen.getAllByText("example@mail.ru").length).toBeGreaterThan(0);
  
    const dropdown = helpButton.parentElement.querySelector(".header-help__dropdown");
    expect(dropdown).toHaveClass("is-open");
  
    fireEvent.click(helpButton);
  
    expect(helpButton).toHaveAttribute("aria-expanded", "false");
    expect(dropdown).not.toHaveClass("is-open");
  });

  it("renders private header after successful profile sync", async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 15,
      avatar_url: "avatar-test.jpg",
    });

    renderHeader({
      token: "token",
      localStorageToken: makeToken({ id: 15 }),
    });

    const profileLinks = await screen.findAllByRole("link", {
      name: /^профиль$/i,
    });

    expect(profileLinks.length).toBeGreaterThan(0);
    expect(profileLinks[0]).toHaveAttribute("href", "/profiles/15");

    const logoutButtons = screen.getAllByRole("button", { name: /выйти/i });
    expect(logoutButtons.length).toBeGreaterThan(0);

    const avatar = screen.getAllByAltText(/аватар пользователя/i)[0];
    expect(avatar).toHaveAttribute("src", "avatar-test.jpg");
  });

  it("uses token user id when profile id is missing", async () => {
    mockGetMyProfile.mockResolvedValue({
      avatar_url: "",
    });

    renderHeader({
      token: "token",
      localStorageToken: makeToken({ id: 77 }),
    });

    const profileLinks = await screen.findAllByRole("link", {
      name: /^профиль$/i,
    });

    expect(profileLinks[0]).toHaveAttribute("href", "/profiles/77");
  });

  it("falls back to public header and removes token when profile request fails", async () => {
    mockGetMyProfile.mockRejectedValue(new Error("Unauthorized"));

    renderHeader({
      token: "token",
      localStorageToken: makeToken({ id: 50 }),
    });

    await waitFor(() => {
      expect(mockRemoveToken).toHaveBeenCalled();
    });

    expect(screen.getAllByRole("link", { name: /войти/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /выйти/i })).not.toBeInTheDocument();
  });

  it("logs out from private header", async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 12,
      avatar_url: "",
    });

    renderHeader({
      token: "token",
      localStorageToken: makeToken({ id: 12 }),
    });

    const logoutButtons = await screen.findAllByRole("button", { name: /выйти/i });
    fireEvent.click(logoutButtons[0]);

    expect(mockRemoveToken).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("renders forced public variant even when token exists", async () => {
    renderHeader({
      headerProps: { variant: "public" },
      token: "token",
      localStorageToken: makeToken({ id: 99 }),
    });

    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: /войти/i }).length).toBeGreaterThan(0);
    });

    expect(screen.queryByRole("button", { name: /выйти/i })).not.toBeInTheDocument();
  });

  it("opens mobile public menu", () => {
    renderHeader();

    fireEvent.click(screen.getByRole("button", { name: "Открыть меню" }));

    expect(screen.getAllByText(/хочу помочь/i).length).toBeGreaterThan(1);
    expect(screen.getAllByText(/регистрация/i).length).toBeGreaterThan(1);
  });

  it("opens mobile help section in public menu", () => {
    renderHeader();

    fireEvent.click(screen.getByRole("button", { name: "Открыть меню" }));

    const mobileHelpButton = screen.getAllByRole("button", { name: /нужна помощь/i })[0];
    fireEvent.click(mobileHelpButton);

    expect(screen.getAllByText("example@mail.ru").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/vk/i).length).toBeGreaterThan(0);
  });

  it("closes help dropdown on outside click", () => {
    renderHeader();
  
    const helpButton = screen.getAllByRole("button", { name: /нужна помощь/i })[0];
  
    fireEvent.click(helpButton);
    expect(helpButton).toHaveAttribute("aria-expanded", "true");
  
    fireEvent.mouseDown(document.body);
  
    expect(helpButton).toHaveAttribute("aria-expanded", "false");
  });
  
  it("falls back to login profile link when token payload is invalid", async () => {
    mockGetMyProfile.mockResolvedValue({
      avatar_url: "",
    });
  
    renderHeader({
      token: "token",
      localStorageToken: "broken.token.value",
    });
  
    const profileLinks = await screen.findAllByRole("link", {
      name: /^профиль$/i,
    });
  
    expect(profileLinks[0]).toHaveAttribute("href", "/login");
  });

  it("uses login link in private header when localStorage token is absent and profile id is missing", async () => {
    mockGetMyProfile.mockResolvedValue({
      avatar_url: "",
    });
  
    renderHeader({ token: "token", localStorageToken: null });
  
    const profileLinks = await screen.findAllByRole("link", {
      name: /^профиль$/i,
    });
  
    expect(profileLinks[0]).toHaveAttribute("href", "/login");
  });

  it("opens public mobile menu", () => {
    renderHeader();
  
    const menuButton = screen.getByRole("button", { name: "Открыть меню" });
    fireEvent.click(menuButton);
  
    expect(
      screen.getAllByRole("link", { name: /хочу помочь/i }).length
    ).toBeGreaterThan(0);
  
    expect(
      screen.getAllByRole("button", { name: /нужна помощь/i }).length
    ).toBeGreaterThan(0);
  
    expect(
      screen.getAllByRole("link", { name: /войти/i }).length
    ).toBeGreaterThan(0);
  
    expect(
      screen.getAllByRole("link", { name: /регистрация/i }).length
    ).toBeGreaterThan(0);
  });

  it("marks private profile navigation as active on profile route", async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 15,
      avatar_url: "",
    });
  
    renderHeader({
      route: "/profiles/15",
      token: "token",
      localStorageToken: makeToken({ id: 15 }),
    });
  
    const profileLinks = await screen.findAllByText("Профиль");
  
    expect(profileLinks[0]).toHaveClass("header__nav-link--active");
  });
  
  it("opens private mobile menu and closes it by mobile link click", async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 15,
      avatar_url: "",
    });
  
    const { container } = renderHeader({
      token: "token",
      localStorageToken: makeToken({ id: 15 }),
    });
  
    await screen.findAllByRole("button", { name: /открыть меню профиля/i });
  
    const menuButton = screen.getByRole("button", { name: "Открыть меню" });

    await act(async () => {
      fireEvent.click(menuButton);
    });
  
    const mobileMenu = container.querySelector("#mobileMenu");
    expect(mobileMenu).toHaveClass("is-open");
  
    const mobileEventsLink = screen.getAllByRole("link", { name: /мероприятия/i }).at(-1);

    await act(async () => {
      fireEvent.click(mobileEventsLink);
    });
  
    await waitFor(() => {
      expect(mobileMenu).not.toHaveClass("is-open");
    });
  });
  
  it("logs out from private mobile menu", async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 15,
      avatar_url: "",
    });
  
    renderHeader({
      token: "token",
      localStorageToken: makeToken({ id: 15 }),
    });
  
    await screen.findAllByRole("button", { name: /открыть меню профиля/i });
  
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Открыть меню" }));
    });
  
    const logoutButtons = screen.getAllByRole("button", { name: /выйти/i });

    await act(async () => {
      fireEvent.click(logoutButtons.at(-1));
    });
  
    await waitFor(() => {
      expect(mockRemoveToken).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("keeps public help dropdown open when clicking inside it", () => {
    renderHeader();
  
    const helpButton = screen.getAllByRole("button", { name: /нужна помощь/i })[0];
  
    fireEvent.click(helpButton);
    expect(helpButton).toHaveAttribute("aria-expanded", "true");
  
    fireEvent.mouseDown(screen.getByText(/контакты/i));
  
    expect(helpButton).toHaveAttribute("aria-expanded", "true");
  });
  
  it("uses login profile link when token payload has no id", async () => {
    mockGetMyProfile.mockResolvedValue({
      avatar_url: "",
    });
  
    renderHeader({
      token: "token",
      localStorageToken: makeToken({ role: "volunteer" }),
    });
  
    const profileLinks = await screen.findAllByRole("link", {
      name: /^профиль$/i,
    });
  
    expect(profileLinks[0]).toHaveAttribute("href", "/login");
  });
  
  it("opens private mobile menu and closes it by profile link click", async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 22,
      avatar_url: "",
    });
  
    renderHeader({
      token: "token",
      localStorageToken: makeToken({ id: 22 }),
    });
  
    await screen.findAllByRole("button", { name: /открыть меню профиля/i });
  
    const menuButton = screen.getByRole("button", { name: "Открыть меню" });
  
    await act(async () => {
      fireEvent.click(menuButton);
    });
  
    const mobileMenu = document.querySelector("#mobileMenu");
    expect(mobileMenu).toHaveClass("is-open");
  
    expect(screen.getAllByRole("link", { name: /главная/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /мероприятия/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /профиль/i }).length).toBeGreaterThan(0);
  
    await act(async () => {
      fireEvent.click(screen.getAllByRole("link", { name: /профиль/i }).at(-1));
    });
  
    await waitFor(() => {
      expect(mobileMenu).not.toHaveClass("is-open");
    });
  });
  
  it("logs out from private mobile menu", async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 22,
      avatar_url: "",
    });
  
    renderHeader({
      token: "token",
      localStorageToken: makeToken({ id: 22 }),
    });
  
    await screen.findAllByRole("button", { name: /открыть меню профиля/i });
  
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Открыть меню" }));
    });
  
    const logoutButtons = screen.getAllByRole("button", { name: /выйти/i });

    await act(async () => {
      fireEvent.click(logoutButtons.at(-1));
    });
  
    await waitFor(() => {
      expect(mockRemoveToken).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("closes public help dropdown on Escape", async () => {
    renderHeader();

    const helpButton = screen.getAllByRole("button", { name: /нужна помощь/i })[0];

    await act(async () => {
      fireEvent.click(helpButton);
    });

    expect(helpButton).toHaveAttribute("aria-expanded", "true");

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });

    await waitFor(() => {
      expect(helpButton).toHaveAttribute("aria-expanded", "false");
    });
  });

  it("closes private profile dropdown on Escape", async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 15,
      role: "volunteer",
      avatar_url: "",
    });

    renderHeader({
      token: "token",
      localStorageToken: makeToken({ id: 15 }),
    });

    const profileButtons = await screen.findAllByRole("button", {
      name: /открыть меню профиля/i,
    });

    await act(async () => {
      fireEvent.click(profileButtons[0]);
    });

    expect(profileButtons[0]).toHaveAttribute("aria-expanded", "true");

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });

    await waitFor(() => {
      expect(profileButtons[0]).toHaveAttribute("aria-expanded", "false");
    });
  });

  it("shows unread notifications counter for volunteer", async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 31,
      role: "volunteer",
      avatar_url: "",
    });
    mockGetUnreadNotificationsCount.mockResolvedValue({ count: 7 });

    renderHeader({
      token: "token",
      localStorageToken: makeToken({ id: 31 }),
    });

    expect(
      await screen.findAllByLabelText(/непрочитанных уведомлений: 7/i)
    ).toHaveLength(2);
    expect(mockGetUnreadNotificationsCount).toHaveBeenCalledTimes(1);
  });

  it("falls back to zero unread notifications when counter request fails", async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 32,
      role: "coordinator",
      avatar_url: "",
    });
    mockGetUnreadNotificationsCount.mockRejectedValue(new Error("Notifications failed"));

    renderHeader({
      token: "token",
      localStorageToken: makeToken({ id: 32 }),
    });

    expect(
      await screen.findAllByLabelText(/непрочитанных уведомлений: 0/i)
    ).toHaveLength(2);
    expect(mockGetUnreadNotificationsCount).toHaveBeenCalledTimes(1);
  });

  it("does not request unread notifications for admin profile", async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 33,
      role: "admin",
      avatar_url: "",
    });

    renderHeader({
      token: "token",
      localStorageToken: makeToken({ id: 33 }),
    });

    expect(
      await screen.findAllByLabelText(/непрочитанных уведомлений: 0/i)
    ).toHaveLength(2);
    expect(mockGetUnreadNotificationsCount).not.toHaveBeenCalled();
  });
});
