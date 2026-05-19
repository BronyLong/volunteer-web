import "./AdminPage.css";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import {
  deleteAdminUserProfile,
  deleteEvent,
  getAdminEvents,
  getAdminLogs,
  getAdminUsers,
  getUserFromToken,
  updateAdminEventCoordinator,
  updateAdminUserActive,
  updateAdminUserRole,
} from "../api";

import { getProfileAvatar } from "../utils/avatarUtils";

const ROLES = [
  { value: "volunteer", label: "Волонтер" },
  { value: "coordinator", label: "Координатор" },
  { value: "admin", label: "Администратор" },
];

const LOG_FILTER_FIELDS = [
  "user_id",
  "action",
  "entity_type",
  "entity_id",
  "method",
  "route",
  "status",
];

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

const USER_COLUMNS = [
  { field: "id", title: "id", sortable: true },
  { field: "avatar_url", title: "avatar" },
  { field: "email", title: "email" },
  { field: "full_name", title: "name" },
  { field: "phone", title: "phone" },
  { field: "city", title: "city" },
  { field: "role", title: "role", sortable: true },
  { field: "is_active", title: "is_active", sortable: true },
  { field: "created_at", title: "created_at", sortable: true },
  { field: "actions", title: "actions" },
];

const EVENT_COLUMNS = [
  { field: "id", title: "id", sortable: true },
  { field: "title", title: "title", sortable: true },
  { field: "category_name", title: "category", sortable: true },
  { field: "start_at", title: "start_at", sortable: true },
  { field: "location", title: "location", sortable: true },
  { field: "participant_limit", title: "participant_limit", sortable: true },
  { field: "available_slots", title: "available_slots", sortable: true },
  { field: "created_by", title: "coordinator", sortable: true },
  { field: "assign_coordinator", title: "assign_coordinator" },
  { field: "created_at", title: "created_at", sortable: true },
  { field: "actions", title: "actions" },
];

const LOG_COLUMNS = [
  { field: "id", title: "id", sortable: true },
  { field: "user_id", title: "user_id", sortable: true },
  { field: "user_role", title: "user_role", sortable: true },
  { field: "action", title: "action", sortable: true },
  { field: "entity_type", title: "entity_type", sortable: true },
  { field: "entity_id", title: "entity_id", sortable: true },
  { field: "method", title: "method", sortable: true },
  { field: "route", title: "route", sortable: true },
  { field: "status", title: "status", sortable: true },
  { field: "ip_address", title: "ip_address" },
  { field: "user_agent", title: "user_agent" },
  { field: "created_at", title: "created_at", sortable: true },
];

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("ru-RU");
}

function getFullName(item) {
  const fullName = `${item.first_name || ""} ${item.middle_name || ""} ${item.last_name || ""}`.trim();
  return fullName || "Не указано";
}

function getComparableValue(item, field) {
  if (field === "full_name") return getFullName(item).toLowerCase();

  const value = item[field];

  if (value === null || value === undefined) return "";

  if (typeof value === "boolean") return value ? 1 : 0;

  if (field.includes("_at")) {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? String(value).toLowerCase() : time;
  }

  if (typeof value === "number") return value;

  const numeric = Number(value);
  if (String(value).trim() !== "" && !Number.isNaN(numeric)) return numeric;

  return String(value).toLowerCase();
}

function sortItems(items, sort) {
  if (!sort.field || !sort.direction) return items;

  return [...items].sort((a, b) => {
    const aValue = getComparableValue(a, sort.field);
    const bValue = getComparableValue(b, sort.field);

    if (aValue < bValue) return sort.direction === "asc" ? -1 : 1;
    if (aValue > bValue) return sort.direction === "asc" ? 1 : -1;
    return 0;
  });
}

function getSortMark(sort, section, field) {
  if (sort.section !== section || sort.field !== field) return "";
  return sort.direction === "asc" ? " ↑" : " ↓";
}

function getPageItems(items, page, rowsPerPage) {
  const start = (page - 1) * rowsPerPage;
  return items.slice(start, start + rowsPerPage);
}

function getTotalPages(items, rowsPerPage) {
  return Math.max(1, Math.ceil(items.length / rowsPerPage));
}

function AdminTableHead({ columns, section, sort, onSort }) {
  return (
    <thead>
      <tr>
        {columns.map((column) => (
          <th key={column.field}>
            {column.sortable ? (
              <button
                type="button"
                className="admin-sort-button"
                onClick={() => onSort(section, column.field)}
              >
                {column.title}
                {getSortMark(sort, section, column.field)}
              </button>
            ) : (
              column.title
            )}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function AdminTableFooter({
  total,
  page,
  rowsPerPage,
  onRowsPerPageChange,
  onPageChange,
}) {
  const totalPages = getTotalPages(Array.from({ length: total }), rowsPerPage);
  const safePage = Math.min(page, totalPages);
  const startRow = total === 0 ? 0 : (safePage - 1) * rowsPerPage + 1;
  const endRow = Math.min(safePage * rowsPerPage, total);

  return (
    <div className="admin-table-footer">
      <div className="admin-table-footer__rows">
        <span>Строк на странице:</span>
        <select
          className="admin-select admin-select--small"
          value={rowsPerPage}
          onChange={(event) => onRowsPerPageChange(Number(event.target.value))}
        >
          {ROWS_PER_PAGE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-table-footer__pages">
        <span>
          {startRow}-{endRow} из {total}
        </span>
        <button
          type="button"
          className="admin-page-button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(1)}
        >
          «
        </button>
        <button
          type="button"
          className="admin-page-button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          ‹
        </button>
        <span className="admin-table-footer__current">
          {safePage} / {totalPages}
        </span>
        <button
          type="button"
          className="admin-page-button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          ›
        </button>
        <button
          type="button"
          className="admin-page-button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(totalPages)}
        >
          »
        </button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const currentUser = getUserFromToken();

  const [activeSection, setActiveSection] = useState("users");
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState("");
  const [coordinatorByEvent, setCoordinatorByEvent] = useState({});
  const [sort, setSort] = useState({
    section: "users",
    field: "created_at",
    direction: "desc",
  });
  const [rowsPerPage, setRowsPerPage] = useState({
    users: 10,
    events: 10,
    logs: 10,
  });
  const [page, setPage] = useState({
    users: 1,
    events: 1,
    logs: 1,
  });

  const [coordinators, setCoordinators] = useState([]);
  const [totalRows, setTotalRows] = useState({
    users: 0,
    events: 0,
    logs: 0,
  });

  const pagedUsers = users;
  const pagedEvents = events;
  const pagedLogs = logs;

  function getPaginationParams(section) {
    const isCurrentSort = sort.section === section;

    return {
      page: page[section],
      limit: rowsPerPage[section],
      sort_field: isCurrentSort ? sort.field : "created_at",
      sort_direction: isCurrentSort ? sort.direction : "desc",
    };
  }

  function normalizePagedResponse(data) {
    if (Array.isArray(data)) {
      return {
        items: data,
        pagination: { total: data.length },
      };
    }

    return {
      items: Array.isArray(data?.items) ? data.items : [],
      pagination: data?.pagination || { total: 0 },
    };
  }

  useEffect(() => {
    if (currentUser?.role !== "admin") {
      navigate("/", { replace: true });
    }
  }, [currentUser?.role, navigate]);

  useEffect(() => {
    if (currentUser?.role !== "admin") return;

    async function loadCoordinators() {
      try {
        const data = await getAdminUsers({
          page: 1,
          limit: 500,
          role: "coordinator",
          is_active: true,
          sort_field: "created_at",
          sort_direction: "desc",
        });
        const normalized = normalizePagedResponse(data);
        setCoordinators(normalized.items);
      } catch (err) {
        setError(err.message || "Не удалось загрузить координаторов");
      }
    }

    loadCoordinators();
  }, [currentUser?.role]);

  useEffect(() => {
    if (currentUser?.role !== "admin") return;

    async function loadUsers() {
      try {
        setLoading(true);
        setError("");
        const data = await getAdminUsers(getPaginationParams("users"));
        const normalized = normalizePagedResponse(data);
        setUsers(normalized.items);
        setTotalRows((prev) => ({ ...prev, users: normalized.pagination.total || 0 }));
      } catch (err) {
        setError(err.message || "Не удалось загрузить пользователей");
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, [currentUser?.role, page.users, rowsPerPage.users, sort]);

  useEffect(() => {
    if (currentUser?.role !== "admin") return;

    async function loadEvents() {
      try {
        setLoading(true);
        setError("");
        const data = await getAdminEvents(getPaginationParams("events"));
        const normalized = normalizePagedResponse(data);
        setEvents(normalized.items);
        setTotalRows((prev) => ({ ...prev, events: normalized.pagination.total || 0 }));
      } catch (err) {
        setError(err.message || "Не удалось загрузить мероприятия");
      } finally {
        setLoading(false);
      }
    }

    loadEvents();
  }, [currentUser?.role, page.events, rowsPerPage.events, sort]);

  useEffect(() => {
    if (currentUser?.role !== "admin") return;

    async function loadLogs() {
      try {
        setLogsLoading(true);
        setError("");
        const data = await getAdminLogs({
          ...filters,
          ...getPaginationParams("logs"),
        });
        const normalized = normalizePagedResponse(data);
        setLogs(normalized.items);
        setTotalRows((prev) => ({ ...prev, logs: normalized.pagination.total || 0 }));
      } catch (err) {
        setError(err.message || "Не удалось загрузить логи");
      } finally {
        setLogsLoading(false);
      }
    }

    loadLogs();
  }, [filters, currentUser?.role, page.logs, rowsPerPage.logs, sort]);

  async function reloadUsers() {
    const data = await getAdminUsers(getPaginationParams("users"));
    const normalized = normalizePagedResponse(data);
    setUsers(normalized.items);
    setTotalRows((prev) => ({ ...prev, users: normalized.pagination.total || 0 }));

    const coordinatorsData = await getAdminUsers({
      page: 1,
      limit: 500,
      role: "coordinator",
      is_active: true,
      sort_field: "created_at",
      sort_direction: "desc",
    });
    setCoordinators(normalizePagedResponse(coordinatorsData).items);
  }

  async function reloadEvents() {
    const data = await getAdminEvents(getPaginationParams("events"));
    const normalized = normalizePagedResponse(data);
    setEvents(normalized.items);
    setTotalRows((prev) => ({ ...prev, events: normalized.pagination.total || 0 }));
  }

  async function handleRoleChange(userId, role) {
    try {
      setError("");
      await updateAdminUserRole(userId, role);
      await reloadUsers();
    } catch (err) {
      setError(err.message || "Не удалось изменить роль");
    }
  }

  async function handleActiveChange(userId, isActive) {
    try {
      setError("");
      await updateAdminUserActive(userId, isActive);
      await reloadUsers();
    } catch (err) {
      setError(err.message || "Не удалось изменить статус аккаунта");
    }
  }


  async function handleDeleteUserProfile(user) {
    if (String(user.id) === String(currentUser?.id)) {
      setError("Нельзя удалить профиль текущего администратора");
      return;
    }

    if (user.role === "admin") {
      setError("Нельзя удалить профиль администратора");
      return;
    }

    const confirmed = window.confirm(
      "Удалить профиль пользователя? Персональные данные будут обезличены, аккаунт будет деактивирован, а вход в учетную запись станет невозможен."
    );

    if (!confirmed) return;

    try {
      setError("");
      await deleteAdminUserProfile(user.id);
      await reloadUsers();
      const logsData = await getAdminLogs({
        ...filters,
        ...getPaginationParams("logs"),
      });
      const normalizedLogs = normalizePagedResponse(logsData);
      setLogs(normalizedLogs.items);
      setTotalRows((prev) => ({ ...prev, logs: normalizedLogs.pagination.total || 0 }));
    } catch (err) {
      setError(err.message || "Не удалось удалить профиль пользователя");
    }
  }

  async function handleDeleteEvent(eventId) {
    const confirmed = window.confirm("Удалить мероприятие?");
    if (!confirmed) return;

    try {
      setError("");
      await deleteEvent(eventId);
      await reloadEvents();
    } catch (err) {
      setError(err.message || "Не удалось удалить мероприятие");
    }
  }

  async function handleCoordinatorChange(eventId) {
    const coordinatorId = coordinatorByEvent[eventId];

    if (!coordinatorId) {
      setError("Выберите координатора");
      return;
    }

    try {
      setError("");
      await updateAdminEventCoordinator(eventId, coordinatorId);
      await reloadEvents();
    } catch (err) {
      setError(err.message || "Не удалось назначить координатора");
    }
  }

  function handleSort(section, field) {
    setSort((prev) => {
      if (prev.section !== section || prev.field !== field) {
        return { section, field, direction: "asc" };
      }

      return {
        section,
        field,
        direction: prev.direction === "asc" ? "desc" : "asc",
      };
    });

    setPage((prev) => ({ ...prev, [section]: 1 }));
  }

  function handleRowsPerPageChange(section, value) {
    setRowsPerPage((prev) => ({ ...prev, [section]: value }));
    setPage((prev) => ({ ...prev, [section]: 1 }));
  }

  function handlePageChange(section, value) {
    setPage((prev) => ({ ...prev, [section]: value }));
  }

  function addLogFilter(field, value) {
    if (!LOG_FILTER_FIELDS.includes(field)) return;
    if (value === null || value === undefined || String(value).trim() === "") {
      return;
    }

    setFilters((prev) => ({
      ...prev,
      [field]: String(value),
    }));
    setPage((prev) => ({ ...prev, logs: 1 }));
    setActiveSection("logs");
  }

  function removeLogFilter(field) {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setPage((prev) => ({ ...prev, logs: 1 }));
  }

  if (loading) {
    return (
      <main className="admin-page">
        <div className="container">
          <div className="admin-state">Загрузка панели администратора...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="container">
        <div className="admin-header">
          <h1 className="admin-header__title">Администрирование</h1>

          <Link to={`/profiles/${currentUser.id}`} className="admin-header__back">
            В профиль
          </Link>
        </div>

        {error ? <div className="admin-error">{error}</div> : null}

        <div className="admin-tabs">
          <button
            type="button"
            className={`admin-tabs__button ${
              activeSection === "users" ? "admin-tabs__button--active" : ""
            }`}
            onClick={() => setActiveSection("users")}
          >
            Пользователи
          </button>
          <button
            type="button"
            className={`admin-tabs__button ${
              activeSection === "events" ? "admin-tabs__button--active" : ""
            }`}
            onClick={() => setActiveSection("events")}
          >
            Мероприятия
          </button>
          <button
            type="button"
            className={`admin-tabs__button ${
              activeSection === "logs" ? "admin-tabs__button--active" : ""
            }`}
            onClick={() => setActiveSection("logs")}
          >
            Логи
          </button>
        </div>

        {activeSection === "users" ? (
          <section className="admin-panel">
            <div className="admin-panel__top">
              <h2 className="admin-panel__title">Пользователи</h2>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-db-table">
                <AdminTableHead
                  columns={USER_COLUMNS}
                  section="users"
                  sort={sort}
                  onSort={handleSort}
                />
                <tbody>
                  {pagedUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <Link
                          to={`/profiles/${user.id}`}
                          className="admin-table-link"
                        >
                          {user.id}
                        </Link>
                      </td>
                      <td>
                        <img
                          src={getProfileAvatar(user)}
                          alt="Аватар"
                          className="admin-avatar"
                        />
                      </td>
                      <td>{user.email}</td>
                      <td>{getFullName(user)}</td>
                      <td>{user.phone || ""}</td>
                      <td>{user.city || ""}</td>
                      <td>
                        <select
                          className="admin-select"
                          value={user.role}
                          onChange={(event) =>
                            handleRoleChange(user.id, event.target.value)
                          }
                        >
                          {ROLES.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{user.is_active ? "true" : "false"}</td>
                      <td>{formatDate(user.created_at)}</td>
                      <td>
                        <div className="admin-actions-cell admin-actions-cell--vertical">
                          {user.is_active ? (
                            <button
                              type="button"
                              className="admin-action admin-action--danger"
                              onClick={() => handleActiveChange(user.id, false)}
                            >
                              Деактивировать
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="admin-action"
                              onClick={() => handleActiveChange(user.id, true)}
                            >
                              Активировать
                            </button>
                          )}

                          <button
                            type="button"
                            className="admin-action admin-action--danger"
                            disabled={
                              String(user.id) === String(currentUser?.id) ||
                              user.role === "admin"
                            }
                            onClick={() => handleDeleteUserProfile(user)}
                          >
                            Удалить профиль
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <AdminTableFooter
              total={totalRows.users}
              page={page.users}
              rowsPerPage={rowsPerPage.users}
              onRowsPerPageChange={(value) =>
                handleRowsPerPageChange("users", value)
              }
              onPageChange={(value) => handlePageChange("users", value)}
            />
          </section>
        ) : null}

        {activeSection === "events" ? (
          <section className="admin-panel">
            <div className="admin-panel__top">
              <h2 className="admin-panel__title">Мероприятия</h2>
              <Link to="/create" className="admin-panel__create">
                Добавить мероприятие
              </Link>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-db-table">
                <AdminTableHead
                  columns={EVENT_COLUMNS}
                  section="events"
                  sort={sort}
                  onSort={handleSort}
                />
                <tbody>
                  {pagedEvents.map((event) => (
                    <tr key={event.id}>
                      <td>
                        <Link
                          to={`/events/${event.id}`}
                          className="admin-table-link"
                        >
                          {event.id}
                        </Link>
                      </td>
                      <td>{event.title}</td>
                      <td>{event.category_name}</td>
                      <td>{formatDate(event.start_at)}</td>
                      <td>{event.location}</td>
                      <td>{event.participant_limit}</td>
                      <td>{event.available_slots}</td>
                      <td>
                        <div>{event.created_by}</div>
                        <div className="admin-muted">
                          {`${event.coordinator_first_name || ""} ${
                            event.coordinator_last_name || ""
                          }`.trim() || event.coordinator_email}
                        </div>
                      </td>
                      <td>
                        <div className="admin-inline-control">
                          <select
                            className="admin-select"
                            value={coordinatorByEvent[event.id] || ""}
                            onChange={(selectEvent) =>
                              setCoordinatorByEvent((prev) => ({
                                ...prev,
                                [event.id]: selectEvent.target.value,
                              }))
                            }
                          >
                            <option value="">Выбрать</option>
                            {coordinators.map((coordinator) => (
                              <option key={coordinator.id} value={coordinator.id}>
                                {getFullName(coordinator)} / {coordinator.email}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="admin-action"
                            onClick={() => handleCoordinatorChange(event.id)}
                          >
                            Назначить
                          </button>
                        </div>
                      </td>
                      <td>{formatDate(event.created_at)}</td>
                      <td>
                        <div className="admin-actions-cell">
                          <Link
                            to={`/events/${event.id}/edit`}
                            className="admin-action admin-action--link"
                          >
                            Изменить
                          </Link>
                          <button
                            type="button"
                            className="admin-action admin-action--danger"
                            onClick={() => handleDeleteEvent(event.id)}
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <AdminTableFooter
              total={totalRows.events}
              page={page.events}
              rowsPerPage={rowsPerPage.events}
              onRowsPerPageChange={(value) =>
                handleRowsPerPageChange("events", value)
              }
              onPageChange={(value) => handlePageChange("events", value)}
            />
          </section>
        ) : null}

        {activeSection === "logs" ? (
          <section className="admin-panel">
            <div className="admin-panel__top">
              <h2 className="admin-panel__title">Логи audit_logs</h2>
              <button
                type="button"
                className="admin-panel__clear"
                onClick={() => { setFilters({}); setPage((prev) => ({ ...prev, logs: 1 })); }}
              >
                Сбросить фильтры
              </button>
            </div>

            <div className="admin-filters">
              {Object.keys(filters).length > 0 ? (
                Object.entries(filters).map(([field, value]) => (
                  <button
                    type="button"
                    key={field}
                    className="admin-filter-chip"
                    onClick={() => removeLogFilter(field)}
                  >
                    {field}: {value} ×
                  </button>
                ))
              ) : (
                <span className="admin-muted">
                  Нажмите на значение в таблице, чтобы добавить фильтр
                </span>
              )}
            </div>

            {logsLoading ? (
              <div className="admin-state admin-state--small">
                Загрузка логов...
              </div>
            ) : null}

            <div className="admin-table-wrap">
              <table className="admin-db-table">
                <AdminTableHead
                  columns={LOG_COLUMNS}
                  section="logs"
                  sort={sort}
                  onSort={handleSort}
                />
                <tbody>
                  {pagedLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.id}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-value-button"
                          onClick={() => addLogFilter("user_id", log.user_id)}
                        >
                          {log.user_id || ""}
                        </button>
                      </td>
                      <td>{log.user_role || ""}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-value-button"
                          onClick={() => addLogFilter("action", log.action)}
                        >
                          {log.action || ""}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-value-button"
                          onClick={() =>
                            addLogFilter("entity_type", log.entity_type)
                          }
                        >
                          {log.entity_type || ""}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-value-button"
                          onClick={() => addLogFilter("entity_id", log.entity_id)}
                        >
                          {log.entity_id || ""}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-value-button"
                          onClick={() => addLogFilter("method", log.method)}
                        >
                          {log.method || ""}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-value-button"
                          onClick={() => addLogFilter("route", log.route)}
                        >
                          {log.route || ""}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-value-button"
                          onClick={() => addLogFilter("status", log.status)}
                        >
                          {log.status || ""}
                        </button>
                      </td>
                      <td>{log.ip_address || ""}</td>
                      <td className="admin-table-text-long">
                        {log.user_agent || ""}
                      </td>
                      <td>{formatDate(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <AdminTableFooter
              total={totalRows.logs}
              page={page.logs}
              rowsPerPage={rowsPerPage.logs}
              onRowsPerPageChange={(value) =>
                handleRowsPerPageChange("logs", value)
              }
              onPageChange={(value) => handlePageChange("logs", value)}
            />
          </section>
        ) : null}
      </div>
    </main>
  );
}
