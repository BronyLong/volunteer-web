import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EventOpenPage from "../src/pages/EventOpenPage";

const mockApiFetch = vi.fn();
const mockDeleteApplication = vi.fn();
const mockRejectApplication = vi.fn();
const mockRestoreApplication = vi.fn();
const mockGetToken = vi.fn();
const mockAcceptApplication = vi.fn();
const mockConfirmApplicationParticipation = vi.fn();
const mockCancelApplicationParticipation = vi.fn();

vi.mock("../src/api", async () => {
  const actual = await vi.importActual("../src/api");
  return {
    ...actual,
    apiFetch: (...args) => mockApiFetch(...args),
    deleteApplication: (...args) => mockDeleteApplication(...args),
    rejectApplication: (...args) => mockRejectApplication(...args),
    restoreApplication: (...args) => mockRestoreApplication(...args),
    getToken: (...args) => mockGetToken(...args),
    acceptApplication: (...args) => mockAcceptApplication(...args),
    confirmApplicationParticipation: (...args) => mockConfirmApplicationParticipation(...args),
    cancelApplicationParticipation: (...args) => mockCancelApplicationParticipation(...args),
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
            status: "pending",
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

    expect(
      await screen.findByText(/заявка отправлена и ожидает решения координатора/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /отозвать/i })).toBeInTheDocument();
  });

  it("withdraws volunteer application", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 22, role: "volunteer" }));

    let myApplications = [
      {
        id: 101,
        event_id: 55,
        status: "pending",
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

  it("shows manager applications and allows rejecting pending applications", async () => {
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
        status: "pending",
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

    renderPage();

    expect(await screen.findByText(/поданные заявки/i)).toBeInTheDocument();
    expect(screen.getByText("Иван Волонтер")).toBeInTheDocument();
    expect(screen.queryByText("Мария Петрова")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /отклонить заявку/i }));

    await waitFor(() => {
      expect(mockRejectApplication).toHaveBeenCalledWith(201);
    });

    expect(
      await screen.findByText(/пока нет заявок для отображения/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/показывать отклоненные заявки/i));

    expect(await screen.findByText("Иван Волонтер")).toBeInTheDocument();
    expect(screen.getByText("Мария Петрова")).toBeInTheDocument();
    expect(screen.getAllByText(/отклонена/i)).toHaveLength(2);
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
            status: "pending",
          },
        ]);
      }
      return Promise.resolve(null);
    });

    renderPage();

    expect(await screen.findByText(/мероприятие завершено/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /принять участие/i })
    ).not.toBeInTheDocument();
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
            status: "pending",
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

    expect(await screen.findByText(/подтверждение заявок/i)).toBeInTheDocument();
    expect(screen.getByText(/принято заявок: 0/i)).toBeInTheDocument();
    expect(screen.getAllByText(/подтверждено: 0/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/не подтверждено: 0/i)).toBeInTheDocument();

    expect(screen.getByText(/иван волонтер/i)).toBeInTheDocument();
    expect(screen.getByText(/заявка ожидает решения/i)).toBeInTheDocument();
    expect(screen.getByText(/участие не засчитывается/i)).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /принять заявку/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /отклонить заявку/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /восстановить заявку/i })).not.toBeInTheDocument();

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

    expect(await screen.findByText(/не удалось подать заявку/i)).toBeInTheDocument();
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
        /контактные данные откроются после приема заявки на это мероприятие/i
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
      await screen.findByText(/пока нет заявок для отображения/i)
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
            status: "pending",
          },
        ]);
      }
      return Promise.resolve(null);
    });

    mockRejectApplication.mockRejectedValueOnce({});

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /отклонить заявку/i }));

    expect(await screen.findByText(/не удалось отклонить заявку/i)).toBeInTheDocument();
  });

  it("hides rejected applications by default and shows them after toggle", async () => {
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

    renderPage();

    expect(await screen.findByText(/поданные заявки/i)).toBeInTheDocument();
    expect(screen.queryByText("Мария Петрова")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /восстановить заявку/i })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/показывать отклоненные заявки/i));

    expect(await screen.findByText("Мария Петрова")).toBeInTheDocument();
    expect(screen.getByText(/отклонена/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /восстановить заявку/i })
    ).not.toBeInTheDocument();
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
            status: "pending",
          },
        ]);
      }
      return Promise.resolve(null);
    });

    mockDeleteApplication.mockRejectedValueOnce({});

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /отозвать/i }));

    expect(await screen.findByText(/не удалось отозвать заявку/i)).toBeInTheDocument();
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

    mockApiFetch.mockImplementation((path) => {
      if (path === "/events/55") {
        return Promise.resolve({
          ...futureEvent,
          email: "",
          phone: "",
        });
      }
      if (path === "/applications/event/55") return Promise.resolve([]);
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await screen.findByText(futureEvent.title);

    const hiddenContacts = screen.getAllByText(/контактные данные скрыты/i);
    expect(hiddenContacts.length).toBeGreaterThan(0);

    expect(container.querySelector(".coordinator-card__hint")).toHaveTextContent(
      "Контактные данные скрыты"
    );
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

  it("shows approved volunteer application status", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 22, role: "volunteer" }));
  
    mockApiFetch.mockImplementation((path) => {
      if (path === "/events/55") return Promise.resolve(futureEvent);
  
      if (path === "/applications/my") {
        return Promise.resolve([
          {
            id: 7,
            event_id: 55,
            status: "approved",
            created_at: "2099-01-01T10:00:00.000Z",
          },
        ]);
      }
  
      return Promise.resolve(null);
    });
  
    renderPage();
  
    expect(await screen.findByText(/вы участвуете в мероприятии/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /отозвать/i })).not.toBeInTheDocument();
  });
  
  it("shows fallback volunteer application status for unknown status", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 22, role: "volunteer" }));
  
    mockApiFetch.mockImplementation((path) => {
      if (path === "/events/55") return Promise.resolve(futureEvent);
  
      if (path === "/applications/my") {
        return Promise.resolve([
          {
            id: 7,
            event_id: 55,
            status: "unknown",
            created_at: "2099-01-01T10:00:00.000Z",
          },
        ]);
      }
  
      return Promise.resolve(null);
    });
  
    renderPage();
  
    expect(await screen.findByText(/вы подали заявку/i)).toBeInTheDocument();
  });
  
  it("uses latest application by date and id", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 22, role: "volunteer" }));
  
    mockApiFetch.mockImplementation((path) => {
      if (path === "/events/55") return Promise.resolve(futureEvent);
  
      if (path === "/applications/my") {
        return Promise.resolve([
          {
            id: 1,
            event_id: 55,
            status: "rejected",
            created_at: "2099-01-01T10:00:00.000Z",
          },
          {
            id: 2,
            event_id: 55,
            status: "pending",
            updated_at: "2099-01-02T10:00:00.000Z",
          },
          {
            id: 3,
            event_id: 999,
            status: "approved",
            created_at: "2099-01-03T10:00:00.000Z",
          },
        ]);
      }
  
      return Promise.resolve(null);
    });
  
    renderPage();
  
    expect(
      await screen.findByText(/заявка отправлена и ожидает решения координатора/i)
    ).toBeInTheDocument();
  });
  
  it("accepts pending application and refreshes manager data", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 10, role: "coordinator" }));
  
    let applications = [
      {
        id: 100,
        user_id: 22,
        first_name: "Иван",
        last_name: "Волонтер",
        email: "ivan@example.com",
        phone: "+79990000000",
        status: "pending",
        created_at: "2099-01-01T10:00:00.000Z",
      },
    ];
  
    mockApiFetch.mockImplementation((path) => {
      if (path === "/events/55") return Promise.resolve(futureEvent);
      if (path === "/applications/event/55") return Promise.resolve(applications);
      return Promise.resolve(null);
    });
  
    mockAcceptApplication.mockImplementation(() => {
      applications = [
        {
          ...applications[0],
          status: "approved",
        },
      ];
  
      return Promise.resolve({ success: true });
    });
  
    renderPage();
  
    expect(await screen.findByText("Иван Волонтер")).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: /принять заявку/i }));
  
    await waitFor(() => {
      expect(mockAcceptApplication).toHaveBeenCalledWith(100);
    });
  
    expect(await screen.findByText(/принята/i)).toBeInTheDocument();
  });
  
  it("shows fallback error when accept request fails without message", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 10, role: "coordinator" }));
  
    mockApiFetch.mockImplementation((path) => {
      if (path === "/events/55") return Promise.resolve(futureEvent);
  
      if (path === "/applications/event/55") {
        return Promise.resolve([
          {
            id: 100,
            user_id: 22,
            first_name: "Иван",
            last_name: "Волонтер",
            email: "ivan@example.com",
            phone: "+79990000000",
            status: "pending",
          },
        ]);
      }
  
      return Promise.resolve(null);
    });
  
    mockAcceptApplication.mockRejectedValue({});
  
    renderPage();
  
    expect(await screen.findByText("Иван Волонтер")).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: /принять заявку/i }));
  
    expect(await screen.findByText(/не удалось принять заявку/i)).toBeInTheDocument();
  });

  it("renders explicit tasks and coordinator fallback avatar without profile link", async () => {
    mockGetToken.mockReturnValue(null);
    mockApiFetch.mockResolvedValue({
      ...futureEvent,
      creator_id: null,
      gender: "female",
      tasks: ["Выдать инвентарь", "Собрать мусор"],
      duration_minutes: 180,
    });

    renderPage();

    expect(await screen.findByText("Выдать инвентарь")).toBeInTheDocument();
    expect(screen.getByText("Собрать мусор")).toBeInTheDocument();
    expect(screen.queryByLabelText(/перейти в профиль координатора/i)).not.toBeInTheDocument();
    expect(screen.getByText("3 ч")).toBeInTheDocument();
  });

  it("confirms and cancels participation for completed approved application", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 10, role: "coordinator" }));

    let applications = [
      {
        id: 100,
        user_id: 22,
        first_name: "Иван",
        middle_name: "Иванович",
        last_name: "Волонтер",
        email: "ivan@example.com",
        phone: "+79990000000",
        status: "approved",
        participation_confirmed: false,
      },
    ];

    mockApiFetch.mockImplementation((path) => {
      if (path === "/events/55") return Promise.resolve(pastEvent);
      if (path === "/applications/event/55") return Promise.resolve(applications);
      return Promise.resolve(null);
    });

    mockConfirmApplicationParticipation.mockImplementation(async () => {
      applications = [
        {
          ...applications[0],
          participation_confirmed: true,
          participation_confirmed_at: "2099-05-10T12:00:00.000Z",
          confirmed_by_first_name: "Анна",
          confirmed_by_middle_name: "",
          confirmed_by_last_name: "Координатор",
        },
      ];
      return { success: true };
    });

    mockCancelApplicationParticipation.mockImplementation(async () => {
      applications = [
        {
          ...applications[0],
          participation_confirmed: false,
          participation_confirmed_at: null,
          confirmed_by_first_name: null,
          confirmed_by_middle_name: null,
          confirmed_by_last_name: null,
        },
      ];
      return { success: true };
    });

    renderPage();

    expect(await screen.findByText(/подтверждение заявок/i)).toBeInTheDocument();
    expect(screen.getByText(/не подтверждено: 1/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /подтвердить/i }));

    await waitFor(() => {
      expect(mockConfirmApplicationParticipation).toHaveBeenCalledWith(100);
    });

    expect(await screen.findByText(/участие подтверждено/i)).toBeInTheDocument();
    expect(screen.getAllByText(/анна\s+координатор/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /отменить/i }));

    await waitFor(() => {
      expect(mockCancelApplicationParticipation).toHaveBeenCalledWith(100);
    });

    expect(await screen.findByText(/участие не подтверждено/i)).toBeInTheDocument();
  });

  it("shows fallback errors when participation confirmation actions fail", async () => {
    mockGetToken.mockReturnValue(makeToken({ id: 10, role: "coordinator" }));

    let applications = [
      {
        id: 100,
        user_id: 22,
        first_name: "Иван",
        last_name: "Волонтер",
        email: "ivan@example.com",
        phone: "+79990000000",
        status: "approved",
        participation_confirmed: false,
      },
    ];

    mockApiFetch.mockImplementation((path) => {
      if (path === "/events/55") return Promise.resolve(pastEvent);
      if (path === "/applications/event/55") return Promise.resolve(applications);
      return Promise.resolve(null);
    });

    mockConfirmApplicationParticipation.mockRejectedValueOnce({});

    const firstView = renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /подтвердить/i }));

    expect(await screen.findByText(/не удалось подтвердить участие/i)).toBeInTheDocument();

    firstView.unmount();

    applications = [
      {
        ...applications[0],
        participation_confirmed: true,
        participation_confirmed_at: "2099-05-10T12:00:00.000Z",
      },
    ];
    mockCancelApplicationParticipation.mockRejectedValueOnce({});

    mockApiFetch.mockImplementation((path) => {
      if (path === "/events/55") return Promise.resolve(pastEvent);
      if (path === "/applications/event/55") return Promise.resolve(applications);
      return Promise.resolve(null);
    });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /отменить/i }));

    expect(
      await screen.findByText(/не удалось отменить подтверждение участия/i)
    ).toBeInTheDocument();
  });
});
