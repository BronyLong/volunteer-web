import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPage from "../src/pages/AdminPage";

const mockDeleteEvent = vi.fn();
const mockDeleteAdminUserProfile = vi.fn();
const mockGetAdminEvents = vi.fn();
const mockGetAdminLogs = vi.fn();
const mockGetAdminUsers = vi.fn();
const mockGetUserFromToken = vi.fn();
const mockUpdateAdminEventCoordinator = vi.fn();
const mockUpdateAdminUserActive = vi.fn();
const mockUpdateAdminUserRole = vi.fn();
const mockNavigate = vi.fn();

vi.mock("../src/api", async () => {
  const actual = await vi.importActual("../src/api");

  return {
    ...actual,
    deleteEvent: (...args) => mockDeleteEvent(...args),
    deleteAdminUserProfile: (...args) => mockDeleteAdminUserProfile(...args),
    getAdminEvents: (...args) => mockGetAdminEvents(...args),
    getAdminLogs: (...args) => mockGetAdminLogs(...args),
    getAdminUsers: (...args) => mockGetAdminUsers(...args),
    getUserFromToken: (...args) => mockGetUserFromToken(...args),
    updateAdminEventCoordinator: (...args) =>
      mockUpdateAdminEventCoordinator(...args),
    updateAdminUserActive: (...args) => mockUpdateAdminUserActive(...args),
    updateAdminUserRole: (...args) => mockUpdateAdminUserRole(...args),
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderPage(route = "/admin") {
  return render(
    <MemoryRouter
      initialEntries={[route]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/" element={<div>Main page</div>} />
        <Route path="/profiles/:id" element={<div>Profile page</div>} />
        <Route path="/events/:id" element={<div>Event page</div>} />
        <Route path="/events/:id/edit" element={<div>Edit event page</div>} />
        <Route path="/create" element={<div>Create page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const users = [
  {
    id: 1,
    first_name: "Анна",
    last_name: "Админ",
    email: "admin@example.com",
    phone: "+79990000001",
    city: "Москва",
    role: "admin",
    is_active: true,
    created_at: "2024-01-01T10:00:00.000Z",
    avatar_url: "",
  },
  {
    id: 2,
    first_name: "Иван",
    last_name: "Координатор",
    email: "coord@example.com",
    phone: "+79990000002",
    city: "Казань",
    role: "coordinator",
    is_active: true,
    created_at: "2024-01-02T10:00:00.000Z",
    avatar_url: "",
  },
  {
    id: 3,
    first_name: "",
    last_name: "",
    email: "volunteer@example.com",
    phone: "",
    city: "",
    role: "volunteer",
    is_active: false,
    created_at: "bad-date",
    avatar_url: "",
  },
];

const events = [
  {
    id: 10,
    title: "Субботник",
    category_name: "Экология",
    start_at: "2099-05-10T10:30:00.000Z",
    location: "Парк",
    participant_limit: 20,
    available_slots: 10,
    created_by: 2,
    coordinator_first_name: "Иван",
    coordinator_last_name: "Координатор",
    coordinator_email: "coord@example.com",
    created_at: "2024-01-03T10:00:00.000Z",
  },
  {
    id: 11,
    title: "Помощь приюту",
    category_name: "Животные",
    start_at: "invalid-date",
    location: "Приют",
    participant_limit: 15,
    available_slots: 5,
    created_by: 99,
    coordinator_first_name: "",
    coordinator_last_name: "",
    coordinator_email: "fallback@example.com",
    created_at: "",
  },
];

const logs = [
  {
    id: 100,
    user_id: 1,
    user_role: "admin",
    action: "UPDATE",
    entity_type: "users",
    entity_id: 3,
    method: "PATCH",
    route: "/api/admin/users/3/role",
    status: 200,
    ip_address: "127.0.0.1",
    user_agent: "Vitest",
    created_at: "2024-01-04T10:00:00.000Z",
  },
  {
    id: 101,
    user_id: null,
    user_role: "",
    action: "",
    entity_type: "",
    entity_id: null,
    method: "",
    route: "",
    status: null,
    ip_address: "",
    user_agent: "",
    created_at: "bad-date",
  },
];

function createPagedResponse(items, params = {}) {
  const page = Number(params.page || 1);
  const limit = Number(params.limit || 10);
  const total = Number(params.total ?? items.length);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit)),
      has_next_page: page * limit < total,
      has_prev_page: page > 1,
    },
  };
}

function paginate(items, params = {}) {
  const page = Number(params?.page || 1);
  const limit = Number(params?.limit || 10);
  const start = (page - 1) * limit;

  return createPagedResponse(items.slice(start, start + limit), {
    ...params,
    page,
    limit,
    total: items.length,
  });
}

function expectLastCallObjectContaining(mock, expected) {
  expect(mock.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining(expected));
}

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();

    mockGetUserFromToken.mockReturnValue({
      id: 1,
      role: "admin",
    });

    mockGetAdminUsers.mockImplementation((params = {}) => {
      if (params?.role === "coordinator") {
        return Promise.resolve(
          createPagedResponse(
            users.filter((user) => user.role === "coordinator"),
            params
          )
        );
      }

      return Promise.resolve(paginate(users, params));
    });

    mockGetAdminEvents.mockImplementation((params = {}) =>
      Promise.resolve(paginate(events, params))
    );

    mockGetAdminLogs.mockImplementation((params = {}) =>
      Promise.resolve(paginate(logs, params))
    );

    mockUpdateAdminUserRole.mockResolvedValue({ success: true });
    mockUpdateAdminUserActive.mockResolvedValue({ success: true });
    mockUpdateAdminEventCoordinator.mockResolvedValue({ success: true });
    mockDeleteEvent.mockResolvedValue({ success: true });
    mockDeleteAdminUserProfile.mockResolvedValue({ success: true });

    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("redirects non-admin user to main page", () => {
    mockGetUserFromToken.mockReturnValue({
      id: 2,
      role: "volunteer",
    });

    renderPage();

    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("shows loading state", async () => {
    mockGetAdminUsers.mockImplementation(() => new Promise(() => {}));
    mockGetAdminEvents.mockImplementation(() => new Promise(() => {}));
    mockGetAdminLogs.mockImplementation(() => new Promise(() => {}));

    renderPage();

    expect(
      await screen.findByText(/загрузка панели администратора/i)
    ).toBeInTheDocument();
  });

  it("shows loading error with message", async () => {
    mockGetAdminUsers.mockRejectedValue(
      new Error("Не удалось загрузить пользователей")
    );

    renderPage();

    expect(
      await screen.findByText(/не удалось загрузить пользователей/i)
    ).toBeInTheDocument();
  });

  it("shows fallback events loading error without message", async () => {
    mockGetAdminEvents.mockRejectedValue({});

    renderPage();

    expect(
      await screen.findByText(/не удалось загрузить мероприятия/i)
    ).toBeInTheDocument();
  });

  it("renders users table and profile link", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: /администрирование/i })
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /в профиль/i })).toHaveAttribute(
      "href",
      "/profiles/1"
    );

    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    expect(screen.getByText("Анна Админ")).toBeInTheDocument();
    expect(screen.getByText("Не указано")).toBeInTheDocument();
    expect(screen.getByText("bad-date")).toBeInTheDocument();

    expect(mockGetAdminUsers).toHaveBeenCalled();
    expect(mockGetAdminEvents).toHaveBeenCalled();
    expect(mockGetAdminLogs).toHaveBeenCalled();
  });

  it("does not render sort buttons for encrypted personal user fields", async () => {
    renderPage();

    await screen.findByText("admin@example.com");

    expect(screen.queryByRole("button", { name: /^email$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^name$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^phone$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^city$/i })).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: /^id$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^role$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^is_active$/i })).toBeInTheDocument();
  });

  it("changes user role and reloads users", async () => {
    renderPage();

    await screen.findByText("volunteer@example.com");

    const selects = screen.getAllByRole("combobox");
    const volunteerRoleSelect = selects.find(
      (select) => select.value === "volunteer"
    );

    fireEvent.change(volunteerRoleSelect, {
      target: {
        value: "coordinator",
      },
    });

    await waitFor(() => {
      expect(mockUpdateAdminUserRole).toHaveBeenCalledWith(3, "coordinator");
      expect(mockGetAdminUsers.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  it("shows fallback role change error", async () => {
    mockUpdateAdminUserRole.mockRejectedValue({});

    renderPage();

    await screen.findByText("volunteer@example.com");

    const selects = screen.getAllByRole("combobox");
    const volunteerRoleSelect = selects.find(
      (select) => select.value === "volunteer"
    );

    fireEvent.change(volunteerRoleSelect, {
      target: {
        value: "admin",
      },
    });

    expect(await screen.findByText(/не удалось изменить роль/i)).toBeInTheDocument();
  });

  it("deactivates and activates users", async () => {
    renderPage();

    await screen.findByText("coord@example.com");

    const coordinatorRow = screen.getByText("coord@example.com").closest("tr");

    fireEvent.click(
      within(coordinatorRow).getByRole("button", { name: /деактивировать/i })
    );

    await waitFor(() => {
      expect(mockUpdateAdminUserActive).toHaveBeenCalledWith(2, false);
    });

    const volunteerRow = screen.getByText("volunteer@example.com").closest("tr");

    fireEvent.click(
      within(volunteerRow).getByRole("button", { name: /активировать/i })
    );

    await waitFor(() => {
      expect(mockUpdateAdminUserActive).toHaveBeenCalledWith(3, true);
    });
  });

  it("shows fallback active status error", async () => {
    mockUpdateAdminUserActive.mockRejectedValue({});

    renderPage();

    await screen.findByText("coord@example.com");

    const coordinatorRow = screen.getByText("coord@example.com").closest("tr");

    fireEvent.click(
      within(coordinatorRow).getByRole("button", { name: /деактивировать/i })
    );

    expect(
      await screen.findByText(/не удалось изменить статус аккаунта/i)
    ).toBeInTheDocument();
  });

  it("changes users rows per page and sends pagination params", async () => {
    renderPage();

    await screen.findByText("admin@example.com");

    const footer = screen.getByText(/1\s*-\s*3\s*из\s*3/i).closest(".admin-table-footer");
    const rowsSelect = within(footer).getByRole("combobox");

    await act(async () => {
      fireEvent.change(rowsSelect, {
        target: {
          value: "20",
        },
      });
    });

    await waitFor(() => {
      expectLastCallObjectContaining(mockGetAdminUsers, {
        page: 1,
        limit: 20,
      });
    });

    expect(await screen.findByText(/1\s*-\s*3\s*из\s*3/i)).toBeInTheDocument();
    expect(screen.getByText(/1\s*\/\s*1/i)).toBeInTheDocument();
  });


  it("deletes volunteer profile after confirmation and reloads users and logs", async () => {
    renderPage();

    await screen.findByText("volunteer@example.com");

    const volunteerRow = screen.getByText("volunteer@example.com").closest("tr");
    fireEvent.click(within(volunteerRow).getByRole("button", { name: /удалить профиль/i }));

    await waitFor(() => {
      expect(mockDeleteAdminUserProfile).toHaveBeenCalledWith(3);
    });

    expect(mockGetAdminUsers).toHaveBeenCalled();
    expect(mockGetAdminLogs).toHaveBeenCalled();
  });

  it("does not delete current admin or another admin profile", async () => {
    renderPage();

    await screen.findByText("admin@example.com");

    const currentAdminRow = screen.getByText("admin@example.com").closest("tr");
    const adminDeleteButton = within(currentAdminRow).getByRole("button", {
      name: /удалить профиль/i,
    });

    expect(adminDeleteButton).toBeDisabled();
    expect(mockDeleteAdminUserProfile).not.toHaveBeenCalled();
  });

  it("shows fallback delete profile error", async () => {
    mockDeleteAdminUserProfile.mockRejectedValue({});

    renderPage();

    await screen.findByText("volunteer@example.com");

    const volunteerRow = screen.getByText("volunteer@example.com").closest("tr");
    fireEvent.click(within(volunteerRow).getByRole("button", { name: /удалить профиль/i }));

    expect(
      await screen.findByText(/не удалось удалить профиль пользователя/i)
    ).toBeInTheDocument();
  });

  it("renders events table", async () => {
    renderPage();

    await screen.findByText("admin@example.com");

    fireEvent.click(screen.getByRole("button", { name: /мероприятия/i }));

    expect(
      screen.getByRole("heading", { name: /мероприятия/i })
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /добавить мероприятие/i })).toHaveAttribute(
      "href",
      "/create"
    );

    expect(screen.getByText("Субботник")).toBeInTheDocument();
    expect(screen.getByText("Помощь приюту")).toBeInTheDocument();
    expect(screen.getByText("fallback@example.com")).toBeInTheDocument();
    expect(screen.getByText("invalid-date")).toBeInTheDocument();
  });

  it("shows coordinator validation error before assigning coordinator", async () => {
    renderPage();

    await screen.findByText("admin@example.com");

    fireEvent.click(screen.getByRole("button", { name: /мероприятия/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /назначить/i })[0]);

    expect(await screen.findByText(/выберите координатора/i)).toBeInTheDocument();
    expect(mockUpdateAdminEventCoordinator).not.toHaveBeenCalled();
  });

  it("assigns coordinator and reloads events", async () => {
    renderPage();

    await screen.findByText("admin@example.com");

    fireEvent.click(screen.getByRole("button", { name: /мероприятия/i }));

    const coordinatorSelect = screen.getAllByRole("combobox").find(
      (select) => select.value === ""
    );

    fireEvent.change(coordinatorSelect, {
      target: {
        value: "2",
      },
    });

    fireEvent.click(screen.getAllByRole("button", { name: /назначить/i })[0]);

    await waitFor(() => {
      expect(mockUpdateAdminEventCoordinator).toHaveBeenCalledWith(10, "2");
      expect(mockGetAdminEvents.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("shows fallback coordinator assign error", async () => {
    mockUpdateAdminEventCoordinator.mockRejectedValue({});

    renderPage();

    await screen.findByText("admin@example.com");

    fireEvent.click(screen.getByRole("button", { name: /мероприятия/i }));

    const coordinatorSelect = screen.getAllByRole("combobox").find(
      (select) => select.value === ""
    );

    fireEvent.change(coordinatorSelect, {
      target: {
        value: "2",
      },
    });

    fireEvent.click(screen.getAllByRole("button", { name: /назначить/i })[0]);

    expect(
      await screen.findByText(/не удалось назначить координатора/i)
    ).toBeInTheDocument();
  });

  it("deletes event after confirmation", async () => {
    renderPage();

    await screen.findByText("admin@example.com");

    fireEvent.click(screen.getByRole("button", { name: /мероприятия/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /удалить/i })[0]);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith("Удалить мероприятие?");
      expect(mockDeleteEvent).toHaveBeenCalledWith(10);
      expect(mockGetAdminEvents.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("does not delete event when confirmation is cancelled", async () => {
    window.confirm.mockReturnValueOnce(false);

    renderPage();

    await screen.findByText("admin@example.com");

    fireEvent.click(screen.getByRole("button", { name: /мероприятия/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /удалить/i })[0]);

    expect(mockDeleteEvent).not.toHaveBeenCalled();
  });

  it("shows fallback delete event error", async () => {
    mockDeleteEvent.mockRejectedValue({});

    renderPage();

    await screen.findByText("admin@example.com");

    fireEvent.click(screen.getByRole("button", { name: /мероприятия/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /удалить/i })[0]);

    expect(
      await screen.findByText(/не удалось удалить мероприятие/i)
    ).toBeInTheDocument();
  });

  it("sorts events table through server params", async () => {
    renderPage();

    await screen.findByText("admin@example.com");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /мероприятия/i }));
    });

    const titleSortButton = await screen.findByRole("button", { name: /^title/i });

    await act(async () => {
      fireEvent.click(titleSortButton);
    });

    expect(await screen.findByRole("button", { name: /title ↑/i })).toBeInTheDocument();

    await waitFor(() => {
      expectLastCallObjectContaining(mockGetAdminEvents, {
        page: 1,
        limit: 10,
        sort_field: "title",
        sort_direction: "asc",
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /title ↑/i }));
    });

    expect(await screen.findByRole("button", { name: /title ↓/i })).toBeInTheDocument();

    await waitFor(() => {
      expectLastCallObjectContaining(mockGetAdminEvents, {
        page: 1,
        limit: 10,
        sort_field: "title",
        sort_direction: "desc",
      });
    });
  });

  it("renders logs table and filters by clicked value", async () => {
    renderPage();

    await screen.findByText("admin@example.com");

    fireEvent.click(screen.getByRole("button", { name: /логи/i }));

    expect(
      screen.getByRole("heading", { name: /логи audit_logs/i })
    ).toBeInTheDocument();

    expect(screen.getByText("Vitest")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "PATCH" }));

    expect(await screen.findByText(/method: PATCH ×/i)).toBeInTheDocument();

    await waitFor(() => {
      expectLastCallObjectContaining(mockGetAdminLogs, { method: "PATCH" });
    });
  });

  it("removes log filter and resets filters", async () => {
    renderPage();

    await screen.findByText("admin@example.com");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /логи/i }));
    });

    await screen.findByRole("heading", { name: /логи audit_logs/i });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "UPDATE" }));
    });

    const chip = await screen.findByText(/action: UPDATE ×/i);

    await act(async () => {
      fireEvent.click(chip);
    });

    await waitFor(() => {
      expect(screen.queryByText(/action: UPDATE ×/i)).not.toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /сбросить фильтры/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/нажмите на значение в таблице, чтобы добавить фильтр/i)
      ).toBeInTheDocument();
    });
  });

  it("shows logs fallback error", async () => {
    renderPage();
  
    await screen.findByText("admin@example.com");
  
    fireEvent.click(screen.getByRole("button", { name: /логи/i }));
  
    await screen.findByRole("heading", { name: /логи audit_logs/i });
  
    mockGetAdminLogs.mockRejectedValueOnce({});
  
    fireEvent.click(screen.getByRole("button", { name: "PATCH" }));
  
    await waitFor(() => {
      expectLastCallObjectContaining(mockGetAdminLogs, { method: "PATCH" });
    });
  
    expect(await screen.findByText(/не удалось загрузить логи/i)).toBeInTheDocument();
  });

  it("handles users pagination buttons and returns to users tab", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 1,
      role: "admin",
    });
  
    const manyUsers = Array.from({ length: 25 }, (_, index) => ({
      id: index + 1,
      email: `user${index + 1}@example.com`,
      first_name: `Имя${index + 1}`,
      last_name: `Фамилия${index + 1}`,
      phone: `+799900000${String(index + 1).padStart(2, "0")}`,
      city: "Москва",
      role: index === 0 ? "admin" : "volunteer",
      is_active: true,
      avatar_url: "",
      created_at: `2024-01-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
    }));
  
    mockGetAdminUsers.mockResolvedValue(manyUsers);
    mockGetAdminEvents.mockResolvedValue([]);
    mockGetAdminLogs.mockResolvedValue([]);
  
    renderPage();
  
    expect(await screen.findByRole("heading", { name: /пользователи/i })).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "›" }));
    expect(await screen.findByText(/11-20 из 25/i)).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "»" }));
    expect(await screen.findByText(/21-25 из 25/i)).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "‹" }));
    expect(await screen.findByText(/11-20 из 25/i)).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "«" }));
    expect(await screen.findByText(/1-10 из 25/i)).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "Мероприятия" }));
    expect(await screen.findByRole("heading", { name: /мероприятия/i })).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "Пользователи" }));
    expect(await screen.findByRole("heading", { name: /пользователи/i })).toBeInTheDocument();
  });

  it("handles events rows per page and pagination controls", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 1,
      role: "admin",
    });
  
    const users = [
      {
        id: 1,
        email: "admin@example.com",
        first_name: "Анна",
        last_name: "Админ",
        phone: "+79990000001",
        city: "Москва",
        role: "admin",
        is_active: true,
        avatar_url: "",
        created_at: "2024-01-01T10:00:00.000Z",
      },
      {
        id: 2,
        email: "coord@example.com",
        first_name: "Иван",
        last_name: "Координатор",
        phone: "+79990000002",
        city: "Казань",
        role: "coordinator",
        is_active: true,
        avatar_url: "",
        created_at: "2024-01-02T10:00:00.000Z",
      },
    ];
  
    const manyEvents = Array.from({ length: 25 }, (_, index) => ({
      id: index + 1,
      title: `Мероприятие ${index + 1}`,
      category_name: "Экология",
      start_at: `2099-02-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
      location: "Парк",
      participant_limit: 20,
      available_slots: 10,
      created_by: "coord@example.com",
      coordinator_first_name: "Иван",
      coordinator_last_name: "Координатор",
      coordinator_email: "coord@example.com",
      created_at: `2024-02-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
    }));
  
    mockGetAdminUsers.mockResolvedValue(users);
    mockGetAdminEvents.mockResolvedValue(manyEvents);
    mockGetAdminLogs.mockResolvedValue([]);
  
    renderPage();
  
    expect(await screen.findByRole("heading", { name: /пользователи/i })).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "Мероприятия" }));
    expect(await screen.findByRole("heading", { name: /мероприятия/i })).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "›" }));
    expect(await screen.findByText(/11-20 из 25/i)).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "»" }));
    expect(await screen.findByText(/21-25 из 25/i)).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "‹" }));
    expect(await screen.findByText(/11-20 из 25/i)).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "«" }));
    expect(await screen.findByText(/1-10 из 25/i)).toBeInTheDocument();
  
    fireEvent.change(screen.getByDisplayValue("10"), {
      target: { value: "20" },
    });
  
    expect(await screen.findByText(/1-20 из 25/i)).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "›" }));
    expect(await screen.findByText(/21-25 из 25/i)).toBeInTheDocument();
  });

  it("handles logs filters for entity, route, status and empty values", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 1,
      role: "admin",
    });
  
    const logs = [
      {
        id: 100,
        user_id: 1,
        user_role: "admin",
        action: "UPDATE",
        entity_type: "users",
        entity_id: 3,
        method: "PATCH",
        route: "/api/admin/users/3/role",
        status: 200,
        ip_address: "127.0.0.1",
        user_agent: "Vitest",
        created_at: "2024-01-04T10:00:00.000Z",
      },
      {
        id: 101,
        user_id: null,
        user_role: "",
        action: "",
        entity_type: "",
        entity_id: "",
        method: "",
        route: "",
        status: "",
        ip_address: "",
        user_agent: "",
        created_at: "bad-date",
      },
    ];
  
    mockGetAdminUsers.mockResolvedValue([
      {
        id: 1,
        email: "admin@example.com",
        first_name: "Анна",
        last_name: "Админ",
        phone: "+79990000001",
        city: "Москва",
        role: "admin",
        is_active: true,
        avatar_url: "",
        created_at: "2024-01-01T10:00:00.000Z",
      },
    ]);
    mockGetAdminEvents.mockResolvedValue([]);
    mockGetAdminLogs.mockResolvedValue(logs);
  
    renderPage();
  
    expect(await screen.findByRole("heading", { name: /пользователи/i })).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "Логи" }));
    expect(await screen.findByRole("heading", { name: /логи audit_logs/i })).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "users" }));
  
    await waitFor(() => {
      expectLastCallObjectContaining(mockGetAdminLogs, {
        entity_type: "users",
      });
    });
  
    expect(await screen.findByText(/entity_type:\s*users/i)).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "3" }));
  
    await waitFor(() => {
      expectLastCallObjectContaining(mockGetAdminLogs, {
        entity_type: "users",
        entity_id: "3",
      });
    });
  
    expect(await screen.findByText(/entity_id:\s*3/i)).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "/api/admin/users/3/role" }));
  
    await waitFor(() => {
      expectLastCallObjectContaining(mockGetAdminLogs, {
        entity_type: "users",
        entity_id: "3",
        route: "/api/admin/users/3/role",
      });
    });
  
    expect(await screen.findByText(/route:\s*\/api\/admin\/users\/3\/role/i)).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "200" }));
  
    await waitFor(() => {
      expectLastCallObjectContaining(mockGetAdminLogs, {
        entity_type: "users",
        entity_id: "3",
        route: "/api/admin/users/3/role",
        status: "200",
      });
    });
  
    expect(await screen.findByText(/status:\s*200/i)).toBeInTheDocument();
  
    const callsBeforeEmptyClick = mockGetAdminLogs.mock.calls.length;
  
    const emptyValueButtons = screen
      .getAllByRole("button")
      .filter((button) => button.className.includes("admin-value-button") && button.textContent.trim() === "");
  
    fireEvent.click(emptyValueButtons[0]);
  
    expect(mockGetAdminLogs).toHaveBeenCalledTimes(callsBeforeEmptyClick);
  
    fireEvent.click(screen.getByText(/entity_type:\s*users/i));
  
    await waitFor(() => {
      expectLastCallObjectContaining(mockGetAdminLogs, {
        entity_id: "3",
        route: "/api/admin/users/3/role",
        status: "200",
      });
      expect(mockGetAdminLogs.mock.calls.at(-1)?.[0]).not.toHaveProperty("entity_type");
    });
  });

  it("handles logs rows per page and pagination controls", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 1,
      role: "admin",
    });
  
    const manyLogs = Array.from({ length: 25 }, (_, index) => ({
      id: index + 1,
      user_id: index + 1,
      user_role: "admin",
      action: index % 2 === 0 ? "UPDATE" : "DELETE",
      entity_type: "users",
      entity_id: index + 10,
      method: index % 2 === 0 ? "PATCH" : "DELETE",
      route: `/api/admin/users/${index + 10}`,
      status: 200,
      ip_address: "127.0.0.1",
      user_agent: "Vitest",
      created_at: `2024-03-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
    }));
  
    mockGetAdminUsers.mockResolvedValue([
      {
        id: 1,
        email: "admin@example.com",
        first_name: "Анна",
        last_name: "Админ",
        phone: "+79990000001",
        city: "Москва",
        role: "admin",
        is_active: true,
        avatar_url: "",
        created_at: "2024-01-01T10:00:00.000Z",
      },
    ]);
    mockGetAdminEvents.mockResolvedValue([]);
    mockGetAdminLogs.mockResolvedValue(manyLogs);
  
    renderPage();
  
    expect(await screen.findByRole("heading", { name: /пользователи/i })).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "Логи" }));
    expect(await screen.findByRole("heading", { name: /логи audit_logs/i })).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "›" }));
    expect(await screen.findByText(/11-20 из 25/i)).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "»" }));
    expect(await screen.findByText(/21-25 из 25/i)).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "‹" }));
    expect(await screen.findByText(/11-20 из 25/i)).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "«" }));
    expect(await screen.findByText(/1-10 из 25/i)).toBeInTheDocument();
  
    fireEvent.change(screen.getByDisplayValue("10"), {
      target: { value: "20" },
    });
  
    expect(await screen.findByText(/1-20 из 25/i)).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "›" }));
    expect(await screen.findByText(/21-25 из 25/i)).toBeInTheDocument();
  
    fireEvent.click(screen.getByRole("button", { name: "id" }));
    expect(await screen.findByText(/1-20 из 25/i)).toBeInTheDocument();
  });

  it("sorts users only by fields allowed for server-side sorting", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 1,
      role: "admin",
    });

    mockGetAdminUsers.mockImplementation((params = {}) =>
      Promise.resolve(paginate(users, params))
    );
    mockGetAdminEvents.mockResolvedValue(createPagedResponse([]));
    mockGetAdminLogs.mockResolvedValue(createPagedResponse([]));

    renderPage();

    expect(await screen.findByRole("heading", { name: /пользователи/i })).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "name" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "phone" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "city" })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "role" }));
    });

    await waitFor(() => {
      expectLastCallObjectContaining(mockGetAdminUsers, {
        page: 1,
        limit: 10,
        sort_field: "role",
        sort_direction: "asc",
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /role ↑/i }));
    });

    await waitFor(() => {
      expectLastCallObjectContaining(mockGetAdminUsers, {
        page: 1,
        limit: 10,
        sort_field: "role",
        sort_direction: "desc",
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "is_active" }));
    });

    await waitFor(() => {
      expectLastCallObjectContaining(mockGetAdminUsers, {
        sort_field: "is_active",
        sort_direction: "asc",
      });
    });
  });

  it("sorts logs through server params", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 1,
      role: "admin",
    });

    mockGetAdminUsers.mockImplementation((params = {}) =>
      Promise.resolve(paginate(users, params))
    );
    mockGetAdminEvents.mockResolvedValue(createPagedResponse([]));
    mockGetAdminLogs.mockImplementation((params = {}) =>
      Promise.resolve(paginate(logs, params))
    );

    renderPage();

    expect(await screen.findByRole("heading", { name: /пользователи/i })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Логи" }));
    });

    expect(await screen.findByRole("heading", { name: /логи audit_logs/i })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "status" }));
    });

    await waitFor(() => {
      expectLastCallObjectContaining(mockGetAdminLogs, {
        page: 1,
        limit: 10,
        sort_field: "status",
        sort_direction: "asc",
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /status ↑/i }));
    });

    await waitFor(() => {
      expectLastCallObjectContaining(mockGetAdminLogs, {
        page: 1,
        limit: 10,
        sort_field: "status",
        sort_direction: "desc",
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "entity_id" }));
    });

    await waitFor(() => {
      expectLastCallObjectContaining(mockGetAdminLogs, {
        sort_field: "entity_id",
        sort_direction: "asc",
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "created_at" }));
    });

    await waitFor(() => {
      expectLastCallObjectContaining(mockGetAdminLogs, {
        sort_field: "created_at",
        sort_direction: "asc",
      });
    });
  });
});
