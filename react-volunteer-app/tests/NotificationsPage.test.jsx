import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotificationsPage from "../src/pages/NotificationsPage";

const mockNavigate = vi.fn();
const mockGetMyProfile = vi.fn();
const mockGetNotifications = vi.fn();
const mockMarkNotificationAsRead = vi.fn();
const mockMarkAllNotificationsAsRead = vi.fn();

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
    getNotifications: (...args) => mockGetNotifications(...args),
    markNotificationAsRead: (...args) => mockMarkNotificationAsRead(...args),
    markAllNotificationsAsRead: (...args) => mockMarkAllNotificationsAsRead(...args),
  };
});

const volunteerProfile = {
  id: 15,
  first_name: "Иван",
  middle_name: "Иванович",
  last_name: "Петров",
  role: "volunteer",
  gender: "male",
};

function renderPage(initialEntry = "/profiles/15/notifications") {
  return render(
    <MemoryRouter
      initialEntries={[initialEntry]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/profiles/:id/notifications" element={<NotificationsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("NotificationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMyProfile.mockResolvedValue(volunteerProfile);
    mockGetNotifications.mockResolvedValue([]);
  });

  it("shows loading state and empty notifications list", async () => {
    renderPage();

    expect(screen.getByText(/загрузка уведомлений/i)).toBeInTheDocument();

    expect(await screen.findByRole("heading", { name: /уведомления/i })).toBeInTheDocument();
    expect(screen.getByText("Иван Иванович Петров")).toBeInTheDocument();
    expect(screen.getByText("Волонтер")).toBeInTheDocument();
    expect(screen.getByText(/уведомлений пока нет/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /прочитать все/i })).toBeDisabled();
  });

  it("renders coordinator role and fallback name", async () => {
    mockGetMyProfile.mockResolvedValue({ id: 15, role: "coordinator" });

    renderPage();

    expect(await screen.findByText("Пользователь")).toBeInTheDocument();
    expect(screen.getByText("Координатор")).toBeInTheDocument();
  });

  it("redirects when route id does not match current profile", async () => {
    renderPage("/profiles/99/notifications");

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/profiles/15/notifications", {
        replace: true,
      });
    });

    expect(mockGetNotifications).not.toHaveBeenCalled();
  });

  it("redirects admin to profile page", async () => {
    mockGetMyProfile.mockResolvedValue({ ...volunteerProfile, role: "admin" });

    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/profiles/15", { replace: true });
    });

    expect(mockGetNotifications).not.toHaveBeenCalled();
  });

  it("shows load error with fallback text", async () => {
    mockGetMyProfile.mockRejectedValue({});

    renderPage();

    expect(await screen.findByText(/не удалось загрузить уведомления/i)).toBeInTheDocument();
  });

  it("renders notifications, marks one notification as read and opens event link", async () => {
    mockGetNotifications.mockResolvedValue([
      {
        id: 1,
        title: "Новое мероприятие",
        body: "Появилось новое мероприятие",
        event_id: 55,
        is_read: false,
        created_at: "2099-05-10T10:30:00",
      },
      {
        id: 2,
        title: "Системное уведомление",
        body: "Без ссылки на мероприятие",
        event_id: null,
        is_read: true,
        created_at: "bad-date",
      },
    ]);
    mockMarkNotificationAsRead.mockResolvedValue({
      is_read: true,
      read_at: "2099-05-10T11:00:00",
    });

    renderPage();

    expect(await screen.findByText("Новое мероприятие")).toBeInTheDocument();
    expect(screen.getByText("Системное уведомление")).toBeInTheDocument();
    expect(screen.getByText("Новое")).toBeInTheDocument();
    expect(screen.getByText("Дата не указана")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /открыть/i })).toHaveAttribute("href", "/events/55");

    fireEvent.click(screen.getByRole("button", { name: /прочитано/i }));

    await waitFor(() => {
      expect(mockMarkNotificationAsRead).toHaveBeenCalledWith(1);
    });

    expect(screen.queryByText("Новое")).not.toBeInTheDocument();
  });

  it("marks all notifications as read", async () => {
    mockGetNotifications.mockResolvedValue([
      {
        id: 1,
        title: "Уведомление",
        body: "Текст",
        is_read: false,
        created_at: null,
      },
    ]);
    mockMarkAllNotificationsAsRead.mockResolvedValue({ success: true });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /прочитать все/i }));

    await waitFor(() => {
      expect(mockMarkAllNotificationsAsRead).toHaveBeenCalled();
    });

    expect(screen.queryByText("Новое")).not.toBeInTheDocument();
  });

  it("shows inline errors when read requests fail", async () => {
    mockGetNotifications.mockResolvedValue([
      {
        id: 1,
        title: "Уведомление",
        body: "Текст",
        is_read: false,
        created_at: null,
      },
    ]);
    mockMarkNotificationAsRead.mockRejectedValueOnce({});
    mockMarkAllNotificationsAsRead.mockRejectedValueOnce(new Error("Не удалось обновить список"));

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /прочитано/i }));

    expect(
      await screen.findByText(/не удалось отметить уведомление прочитанным/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /прочитать все/i }));

    expect(await screen.findByText("Не удалось обновить список")).toBeInTheDocument();
  });
});
