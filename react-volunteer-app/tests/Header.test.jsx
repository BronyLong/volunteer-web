import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Header from "../src/components/Header";

const mockNavigate = vi.fn();
const mockGetToken = vi.fn();
const mockGetMyProfile = vi.fn();
const mockRemoveToken = vi.fn();

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
      name: /открыть профиль/i,
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
      name: /открыть профиль/i,
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

    fireEvent.click(screen.getByRole("button", { name: /открыть меню/i }));

    expect(screen.getAllByText(/хочу помочь/i).length).toBeGreaterThan(1);
    expect(screen.getAllByText(/регистрация/i).length).toBeGreaterThan(1);
  });

  it("opens mobile help section in public menu", () => {
    renderHeader();

    fireEvent.click(screen.getByRole("button", { name: /открыть меню/i }));

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
      name: /открыть профиль/i,
    });
  
    expect(profileLinks[0]).toHaveAttribute("href", "/login");
  });

  it("uses login link in private header when localStorage token is absent and profile id is missing", async () => {
    mockGetMyProfile.mockResolvedValue({
      avatar_url: "",
    });
  
    renderHeader({ token: "token", localStorageToken: null });
  
    const profileLinks = await screen.findAllByRole("link", {
      name: /открыть профиль/i,
    });
  
    expect(profileLinks[0]).toHaveAttribute("href", "/login");
  });

  it("opens public mobile menu", () => {
    renderHeader();
  
    const menuButton = screen.getByRole("button", { name: /открыть меню/i });
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
});