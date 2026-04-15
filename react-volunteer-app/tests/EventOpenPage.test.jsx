import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EventOpenPage from "../src/pages/EventOpenPage";

const mockApiFetch = vi.fn();
const mockDeleteApplication = vi.fn();
const mockRejectApplication = vi.fn();
const mockRestoreApplication = vi.fn();
const mockGetToken = vi.fn();

vi.mock("../src/api", async () => {
  const actual = await vi.importActual("../src/api");
  return {
    ...actual,
    apiFetch: (...args) => mockApiFetch(...args),
    deleteApplication: (...args) => mockDeleteApplication(...args),
    rejectApplication: (...args) => mockRejectApplication(...args),
    restoreApplication: (...args) => mockRestoreApplication(...args),
    getToken: (...args) => mockGetToken(...args),
  };
});

function makeToken(payload) {
  return `a.${btoa(JSON.stringify(payload))}.c`;
}

function renderPage(route = "/events/55") {
  return render(
    <MemoryRouter
      initialEntries={[route]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/events/:id" element={<EventOpenPage />} />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/events/:id/edit" element={<div>Edit page</div>} />
        <Route path="/profiles/:id" element={<div>Profile page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const futureEvent = {
  id: 55,
  title: "Субботник",
  description: "Описание мероприятия",
  category_name: "Экология",
  available_slots: 10,
  participant_limit: 20,
  location: "Парк Победы",
  start_at: "2099-05-10T10:30:00.000Z",
  creator_id: 10,
  first_name: "Анна",
  last_name: "Координатор",
  email: "anna@example.com",
  phone: "+79990001122",
  avatar_url: "",
};

const hiddenContactsEvent = {
  ...futureEvent,
  email: "",
  phone: "",
};

const pastEvent = {
  ...futureEvent,
  start_at: "2000-05-10T10:30:00.000Z",
};

describe("EventOpenPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("shows loading state", () => {
    mockGetToken.mockReturnValue(null);
    mockApiFetch.mockImplementation(() => new Promise(() => {}));

    renderPage();

    expect(screen.getByText(/загрузка мероприятия/i)).toBeInTheDocument();
  });

  it("shows error when event loading fails", async () => {
    mockGetToken.mockReturnValue(null);
    mockApiFetch.mockRejectedValue(new Error("Не удалось загрузить мероприятие"));

    renderPage();

    expect(
      await screen.findByText(/не удалось загрузить мероприятие/i)
    ).toBeInTheDocument();
  });

  it("shows not found when event was not returned", async () => {
    mockGetToken.mockReturnValue(null);
    mockApiFetch.mockResolvedValue(null);

    renderPage();

    expect(await screen.findByText(/мероприятие не найдено/i)).toBeInTheDocument();
  });

  it("shows guest actions and hidden contacts hint", async () => {
    mockGetToken.mockReturnValue(null);
    mockApiFetch.mockResolvedValue(hiddenContactsEvent);

    renderPage();

    expect(await screen.findByText("Субботник")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /войти для участия/i })).toBeInTheDocument();
    expect(screen.getAllByText(/контактные данные скрыты/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /войдите в аккаунт и подайте заявку на это мероприятие, чтобы увидеть контакты координатора/i
      )
    ).toBeInTheDocument();
  });

  it("shows volunteer join button when there is no application", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 22, role: "volunteer" }));

    mockApiFetch.mockImplementation((path) => {
      if (path === "/events/55") return Promise.resolve(futureEvent);
      if (path === "/applications/my") return Promise.resolve([]);
      return Promise.resolve(null);
    });

    renderPage();

    expect(await screen.findByText("Субботник")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /принять участие/i })
    ).toBeInTheDocument();
  });

  it("applies to event and refreshes volunteer data", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 22, role: "volunteer" }));

    let myApplications = [];

    mockApiFetch.mockImplementation((path, options) => {
      if (path === "/events/55") {
        return Promise.resolve({
          ...futureEvent,
          available_slots: myApplications.length > 0 ? 9 : 10,
        });
      }

      if (path === "/applications/my") {
        return Promise.resolve(myApplications);
      }

      if (path === "/applications" && options?.method === "POST") {
        myApplications = [
          {
            id: 101,
            event_id: 55,
            status: "active",
          },
        ];
        return Promise.resolve({ success: true });
      }

      return Promise.resolve(null);
    });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /принять участие/i }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/applications", {
        method: "POST",
        body: JSON.stringify({
          event_id: "55",
        }),
      });
    });

    expect(await screen.findByText(/вы подали заявку/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /отозвать/i })).toBeInTheDocument();
  });

  it("withdraws volunteer application", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 22, role: "volunteer" }));

    let myApplications = [
      {
        id: 101,
        event_id: 55,
        status: "active",
      },
    ];

    mockApiFetch.mockImplementation((path) => {
      if (path === "/events/55") return Promise.resolve(futureEvent);
      if (path === "/applications/my") return Promise.resolve(myApplications);
      return Promise.resolve(null);
    });

    mockDeleteApplication.mockImplementation(async () => {
      myApplications = [];
      return { success: true };
    });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /отозвать/i }));

    await waitFor(() => {
      expect(mockDeleteApplication).toHaveBeenCalledWith(101);
    });

    expect(
      await screen.findByRole("button", { name: /принять участие/i })
    ).toBeInTheDocument();
  });

  it("shows manager applications and allows reject and restore", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 10, role: "coordinator" }));

    let eventApplications = [
      {
        id: 201,
        user_id: 31,
        avatar_url: "",
        first_name: "Иван",
        last_name: "Волонтер",
        email: "ivan@example.com",
        phone: "+79990000001",
        status: "active",
      },
      {
        id: 202,
        user_id: 32,
        avatar_url: "",
        first_name: "Мария",
        last_name: "Петрова",
        email: "maria@example.com",
        phone: "+79990000002",
        status: "rejected",
      },
    ];

    mockApiFetch.mockImplementation((path) => {
      if (path === "/events/55") return Promise.resolve(futureEvent);
      if (path === "/applications/event/55") return Promise.resolve(eventApplications);
      return Promise.resolve(null);
    });

    mockRejectApplication.mockImplementation(async (id) => {
      eventApplications = eventApplications.map((item) =>
        item.id === id ? { ...item, status: "rejected" } : item
      );
      return { success: true };
    });

    mockRestoreApplication.mockImplementation(async (id) => {
      eventApplications = eventApplications.map((item) =>
        item.id === id ? { ...item, status: "active" } : item
      );
      return { success: true };
    });

    renderPage();

    expect(await screen.findByText(/поданные заявки/i)).toBeInTheDocument();
    expect(screen.getByText("Иван Волонтер")).toBeInTheDocument();
    expect(screen.getByText("Мария Петрова")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /отклонить заявку/i }));

    await waitFor(() => {
      expect(mockRejectApplication).toHaveBeenCalledWith(201);
    });

    expect(await screen.findAllByText(/отклонена/i)).toHaveLength(2);

    const restoreButtons = await screen.findAllByRole("button", {
      name: /восстановить заявку/i,
    });
    fireEvent.click(restoreButtons[0]);

    await waitFor(() => {
      expect(mockRestoreApplication).toHaveBeenCalled();
    });

    expect(await screen.findByText(/подана/i)).toBeInTheDocument();
  });

  it("shows completed event state for volunteer without interaction buttons", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 22, role: "volunteer" }));

    mockApiFetch.mockImplementation((path) => {
      if (path === "/events/55") return Promise.resolve(pastEvent);
      if (path === "/applications/my") {
        return Promise.resolve([
          {
            id: 101,
            event_id: 55,
            status: "active",
          },
        ]);
      }
      return Promise.resolve(null);
    });

    renderPage();

    expect(await screen.findByText(/мероприятие завершено/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /принять участие/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /отозвать/i })).not.toBeInTheDocument();
  });

  it("shows completed event applications for coordinator but disables status changes", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 10, role: "coordinator" }));

    mockApiFetch.mockImplementation((path) => {
      if (path === "/events/55") return Promise.resolve(pastEvent);
      if (path === "/applications/event/55") {
        return Promise.resolve([
          {
            id: 201,
            user_id: 31,
            avatar_url: "",
            first_name: "Иван",
            last_name: "Волонтер",
            email: "ivan@example.com",
            phone: "+79990000001",
            status: "active",
          },
          {
            id: 202,
            user_id: 32,
            avatar_url: "",
            first_name: "Мария",
            last_name: "Петрова",
            email: "maria@example.com",
            phone: "+79990000002",
            status: "rejected",
          },
        ]);
      }
      return Promise.resolve(null);
    });

    renderPage();

    expect(await screen.findByText(/поданные заявки/i)).toBeInTheDocument();
    expect(
      screen.getByText(/просмотр заявок доступен, изменение статусов отключено/i)
    ).toBeInTheDocument();

    const rejectButton = screen.getByRole("button", { name: /отклонить заявку/i });
    const restoreButton = screen.getByRole("button", { name: /восстановить заявку/i });

    expect(rejectButton).toBeDisabled();
    expect(restoreButton).toBeDisabled();

    fireEvent.click(rejectButton);
    fireEvent.click(restoreButton);

    expect(mockRejectApplication).not.toHaveBeenCalled();
    expect(mockRestoreApplication).not.toHaveBeenCalled();
  });

  it("shows error when applying fails", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 22, role: "volunteer" }));

    mockApiFetch.mockImplementation((path, options) => {
      if (path === "/events/55") return Promise.resolve(futureEvent);
      if (path === "/applications/my") return Promise.resolve([]);
      if (path === "/applications" && options?.method === "POST") {
        return Promise.reject(new Error("Не удалось подать заявку"));
      }
      return Promise.resolve(null);
    });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /принять участие/i }));

    expect(
      await screen.findByText(/не удалось подать заявку/i)
    ).toBeInTheDocument();
  });

  it("shows volunteer hidden contacts hint", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 22, role: "volunteer" }));
  
    mockApiFetch.mockImplementation((path) => {
      if (path === "/events/55") return Promise.resolve(hiddenContactsEvent);
      if (path === "/applications/my") return Promise.resolve([]);
      return Promise.resolve(null);
    });
  
    renderPage();
  
    expect(
      await screen.findByText(
        /контактные данные откроются после подачи заявки на это мероприятие/i
      )
    ).toBeInTheDocument();
  });
  
  it("shows applications loading state and then empty list for manager", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 10, role: "coordinator" }));
  
    let resolveApplications;
  
    mockApiFetch.mockImplementation((path) => {
      if (path === "/events/55") return Promise.resolve(futureEvent);
      if (path === "/applications/event/55") {
        return new Promise((resolve) => {
          resolveApplications = resolve;
        });
      }
      return Promise.resolve(null);
    });
  
    renderPage();
  
    expect(await screen.findByText(/поданные заявки/i)).toBeInTheDocument();
    expect(screen.getByText(/загрузка заявок/i)).toBeInTheDocument();
  
    resolveApplications([]);
  
    expect(
      await screen.findByText(/пока нет поданных заявок на это мероприятие/i)
    ).toBeInTheDocument();
  });
  
  it("shows fallback task, category, description and location values", async () => {
    mockGetToken.mockReturnValue(null);
  
    mockApiFetch.mockResolvedValue({
      ...futureEvent,
      tasks: [],
      category_name: "",
      creator_id: null,
      description: "",
      location: "",
      available_slots: 0,
      participant_limit: 0,
    });
  
    renderPage();
  
    expect(
      await screen.findByText(/список задач пока не заполнен/i)
    ).toBeInTheDocument();
  
    expect(screen.getByText(/категория не указана/i)).toBeInTheDocument();
    expect(screen.getByText(/описание отсутствует/i)).toBeInTheDocument();
    expect(screen.getByText(/место не указано/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/перейти в профиль координатора/i)
    ).not.toBeInTheDocument();
  });
  
  it("shows fallback error when reject request fails without message", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 10, role: "admin" }));
  
    mockApiFetch.mockImplementation((path) => {
      if (path === "/events/55") return Promise.resolve(futureEvent);
      if (path === "/applications/event/55") {
        return Promise.resolve([
          {
            id: 201,
            user_id: 31,
            avatar_url: "",
            first_name: "Иван",
            last_name: "Волонтер",
            email: "ivan@example.com",
            phone: "+79990000001",
            status: "active",
          },
        ]);
      }
      return Promise.resolve(null);
    });
  
    mockRejectApplication.mockRejectedValueOnce({});
  
    renderPage();
  
    fireEvent.click(await screen.findByRole("button", { name: /отклонить заявку/i }));
  
    expect(
      await screen.findByText(/не удалось отклонить заявку/i)
    ).toBeInTheDocument();
  });
  
  it("shows fallback error when restore request fails without message", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 10, role: "admin" }));
  
    mockApiFetch.mockImplementation((path) => {
      if (path === "/events/55") return Promise.resolve(futureEvent);
      if (path === "/applications/event/55") {
        return Promise.resolve([
          {
            id: 202,
            user_id: 32,
            avatar_url: "",
            first_name: "Мария",
            last_name: "Петрова",
            email: "maria@example.com",
            phone: "+79990000002",
            status: "rejected",
          },
        ]);
      }
      return Promise.resolve(null);
    });
  
    mockRestoreApplication.mockRejectedValueOnce({});
  
    renderPage();
  
    fireEvent.click(
      await screen.findByRole("button", { name: /восстановить заявку/i })
    );
  
    expect(
      await screen.findByText(/не удалось восстановить заявку/i)
    ).toBeInTheDocument();
  });
  
  it("shows fallback error when withdraw request fails without message", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 22, role: "volunteer" }));
  
    mockApiFetch.mockImplementation((path) => {
      if (path === "/events/55") return Promise.resolve(futureEvent);
      if (path === "/applications/my") {
        return Promise.resolve([
          {
            id: 101,
            event_id: 55,
            status: "active",
          },
        ]);
      }
      return Promise.resolve(null);
    });
  
    mockDeleteApplication.mockRejectedValueOnce({});
  
    renderPage();
  
    fireEvent.click(await screen.findByRole("button", { name: /отозвать/i }));
  
    expect(
      await screen.findByText(/не удалось отозвать заявку/i)
    ).toBeInTheDocument();
  });

  it("treats invalid token as guest", async () => {
    mockGetToken.mockReturnValue("broken.token.value");
    mockApiFetch.mockResolvedValue(futureEvent);
  
    renderPage();
  
    expect(await screen.findByText(futureEvent.title)).toBeInTheDocument();
  
    expect(
      screen.queryByRole("link", { name: /редактировать мероприятие/i })
    ).not.toBeInTheDocument();
  
    expect(
      screen.queryByRole("button", { name: /отклонить заявку/i })
    ).not.toBeInTheDocument();
  });

  it("keeps page visible when manager applications request fails", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 10, role: "admin" }));
  
    mockApiFetch.mockImplementation((path) => {
      if (path === "/events/55") return Promise.resolve(futureEvent);
      if (path === "/applications/event/55") return Promise.reject(new Error("boom"));
      return Promise.resolve(null);
    });
  
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  
    renderPage();
  
    expect(await screen.findByText(futureEvent.title)).toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalled();
  
    consoleSpy.mockRestore();
  });

  it("shows generic hidden contacts message for admin when contacts are unavailable", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 1, role: "admin" }));
  
    mockApiFetch.mockResolvedValue({
      ...futureEvent,
      email: "",
      phone: "",
    });
  
    const { container } = renderPage();
  
    await screen.findByText(futureEvent.title);
  
    const hiddenContacts = screen.getAllByText(/контактные данные скрыты/i);
    expect(hiddenContacts.length).toBeGreaterThan(0);
  
    expect(
      container.querySelector(".coordinator-card__hint")
    ).toHaveTextContent("Контактные данные скрыты");
  });

  it("renders event with unknown category name", async () => {
    mockGetToken.mockReturnValue(null);
  
    mockApiFetch.mockResolvedValue({
      ...futureEvent,
      category_name: "Другое",
    });
  
    renderPage();
  
    expect(await screen.findByText(futureEvent.title)).toBeInTheDocument();
    expect(screen.getByText("Другое")).toBeInTheDocument();
  });
});