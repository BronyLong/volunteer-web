import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotificationSettingsPage from "../src/pages/NotificationSettingsPage";

const mockNavigate = vi.fn();
const mockGetMyProfile = vi.fn();
const mockGetNotificationSettings = vi.fn();
const mockUpdateNotificationSettings = vi.fn();

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
    getNotificationSettings: (...args) => mockGetNotificationSettings(...args),
    updateNotificationSettings: (...args) => mockUpdateNotificationSettings(...args),
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

const volunteerSettings = {
  settings: {
    receive_notifications: true,
    notify_new_events: true,
    notify_coordinator_messages: false,
    notify_application_status: true,
    notify_event_assignment: false,
    notify_new_applications: false,
  },
  categories: [
    { id: 1, name: "Экология", enabled: true },
    { id: 2, name: "Детям", enabled: false },
  ],
};

function renderPage(initialEntry = "/profiles/15/notifications/settings") {
  return render(
    <MemoryRouter
      initialEntries={[initialEntry]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/profiles/:id/notifications/settings" element={<NotificationSettingsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("NotificationSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMyProfile.mockResolvedValue(volunteerProfile);
    mockGetNotificationSettings.mockResolvedValue(volunteerSettings);
  });

  it("shows loading state and volunteer notification settings", async () => {
    renderPage();

    expect(screen.getByText(/загрузка настроек/i)).toBeInTheDocument();

    expect(await screen.findByRole("heading", { name: /настроить уведомления/i })).toBeInTheDocument();
    expect(screen.getByText("Иван Иванович Петров")).toBeInTheDocument();
    expect(screen.getByText("Волонтер")).toBeInTheDocument();
    expect(screen.getByLabelText(/^получать уведомления$/i)).toBeChecked();
    expect(screen.getByLabelText(/новых мероприятиях/i)).toBeChecked();
    expect(screen.getByLabelText("Экология")).toBeChecked();
    expect(screen.getByLabelText("Детям")).not.toBeChecked();
    expect(screen.getByRole("link", { name: /к уведомлениям/i })).toHaveAttribute(
      "href",
      "/profiles/15/notifications"
    );
  });

  it("redirects when route id does not match current profile", async () => {
    renderPage("/profiles/99/notifications/settings");

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/profiles/15/notifications/settings", {
        replace: true,
      });
    });

    expect(mockGetNotificationSettings).not.toHaveBeenCalled();
  });

  it("redirects admin to profile page", async () => {
    mockGetMyProfile.mockResolvedValue({ ...volunteerProfile, role: "admin" });

    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/profiles/15", { replace: true });
    });

    expect(mockGetNotificationSettings).not.toHaveBeenCalled();
  });

  it("shows load error with fallback text", async () => {
    mockGetMyProfile.mockRejectedValue({});

    renderPage();

    expect(
      await screen.findByText(/не удалось загрузить настройки уведомлений/i)
    ).toBeInTheDocument();
  });

  it("saves changed volunteer settings and categories", async () => {
    mockUpdateNotificationSettings.mockResolvedValue({
      settings: {
        ...volunteerSettings.settings,
        notify_new_events: false,
      },
      categories: [
        { id: 1, name: "Экология", enabled: false },
        { id: 2, name: "Детям", enabled: true },
      ],
    });

    renderPage();

    fireEvent.click(await screen.findByLabelText(/новых мероприятиях/i));
    fireEvent.click(screen.getByLabelText("Экология"));
    fireEvent.click(screen.getByLabelText("Детям"));
    fireEvent.click(screen.getByRole("button", { name: /сохранить/i }));

    await waitFor(() => {
      expect(mockUpdateNotificationSettings).toHaveBeenCalledWith({
        receive_notifications: true,
        notify_new_events: false,
        notify_coordinator_messages: false,
        notify_application_status: true,
        notify_event_assignment: false,
        notify_new_applications: false,
        categories: [
          { id: 1, name: "Экология", enabled: false },
          { id: 2, name: "Детям", enabled: true },
        ],
      });
    });

    expect(await screen.findByText(/настройки уведомлений сохранены/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Экология")).not.toBeChecked();
    expect(screen.getByLabelText("Детям")).toBeChecked();
  });

  it("renders coordinator settings and saves them", async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 15,
      first_name: "Анна",
      last_name: "Сидорова",
      role: "coordinator",
      gender: "female",
    });
    mockGetNotificationSettings.mockResolvedValue({
      settings: {
        receive_notifications: true,
        notify_new_events: false,
        notify_coordinator_messages: false,
        notify_application_status: false,
        notify_event_assignment: true,
        notify_new_applications: false,
      },
      categories: [],
    });
    mockUpdateNotificationSettings.mockResolvedValue({
      settings: {
        receive_notifications: true,
        notify_new_events: false,
        notify_coordinator_messages: false,
        notify_application_status: false,
        notify_event_assignment: false,
        notify_new_applications: true,
      },
      categories: [],
    });

    renderPage();

    expect(await screen.findByText("Координатор")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/назначении координатором/i));
    fireEvent.click(screen.getByLabelText(/новых заявках/i));
    fireEvent.click(screen.getByRole("button", { name: /сохранить/i }));

    await waitFor(() => {
      expect(mockUpdateNotificationSettings).toHaveBeenCalledWith({
        receive_notifications: true,
        notify_new_events: false,
        notify_coordinator_messages: false,
        notify_application_status: false,
        notify_event_assignment: false,
        notify_new_applications: true,
        categories: [],
      });
    });
  });

  it("shows save error and clears messages after changing checkbox", async () => {
    mockUpdateNotificationSettings.mockRejectedValueOnce({});

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /сохранить/i }));

    expect(
      await screen.findByText(/не удалось сохранить настройки уведомлений/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/^получать уведомления$/i));

    expect(screen.queryByText(/не удалось сохранить настройки уведомлений/i)).not.toBeInTheDocument();
  });

  it("saves volunteer coordinator message and application status settings", async () => {
    mockUpdateNotificationSettings.mockResolvedValue({
      settings: {
        ...volunteerSettings.settings,
        notify_coordinator_messages: true,
        notify_application_status: false,
      },
      categories: volunteerSettings.categories,
    });

    renderPage();

    fireEvent.click(await screen.findByLabelText(/уведомления от координатора/i));
    fireEvent.click(screen.getByLabelText(/изменении статуса заявки/i));
    fireEvent.click(screen.getByRole("button", { name: /сохранить/i }));

    await waitFor(() => {
      expect(mockUpdateNotificationSettings).toHaveBeenCalledWith({
        receive_notifications: true,
        notify_new_events: true,
        notify_coordinator_messages: true,
        notify_application_status: false,
        notify_event_assignment: false,
        notify_new_applications: false,
        categories: volunteerSettings.categories,
      });
    });
  });
});
