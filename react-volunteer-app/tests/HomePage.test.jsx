import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "../src/pages/HomePage";

const mockGetEvents = vi.fn();

vi.mock("../src/api", () => ({
  getEvents: (...args) => mockGetEvents(...args),
}));

function renderPage() {
  return render(
    <MemoryRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <HomePage />
    </MemoryRouter>
  );
}

function createEventsResponse(items) {
  return {
    items,
    pagination: {
      page: 1,
      limit: 100,
      total: items.length,
      total_pages: 1,
      has_next_page: false,
      has_prev_page: false,
    },
  };
}

function makeEvent(overrides = {}) {
  return {
    id: 1,
    title: "Экологическая акция",
    description: "Описание мероприятия",
    category_name: "Экология",
    start_at: "2099-06-15T10:00:00.000Z",
    location: "Центральный парк",
    available_slots: 10,
    participant_limit: 20,
    image_url: null,
    ...overrides,
  };
}

function expectTextVisible(text) {
  expect(screen.getAllByText(text).length).toBeGreaterThan(0);
}

async function expectTextLoaded(text) {
  const elements = await screen.findAllByText(text);
  expect(elements.length).toBeGreaterThan(0);
}

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    mockGetEvents.mockResolvedValue(createEventsResponse([]));

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders static content", async () => {
    renderPage();

    expect(
      screen.getByRole("heading", {
        name: /присоединяйтесь к добрым делам/i,
      })
    ).toBeInTheDocument();

    expect(screen.getByText(/сайт помогает регистрироваться/i)).toBeInTheDocument();

    const eventsLinks = screen.getAllByRole("link", {
      name: /смотреть мероприятия/i,
    });

    expect(eventsLinks.length).toBeGreaterThan(0);
    expect(eventsLinks.every((link) => link.getAttribute("href") === "/events")).toBe(
      true
    );

    expect(screen.getByRole("link", { name: /узнать о платформе/i })).toHaveAttribute(
      "href",
      "#advantages"
    );

    expect(screen.getByText("Что получает пользователь от системы")).toBeInTheDocument();
    expect(screen.getByText("Как стать волонтером в 4 шага")).toBeInTheDocument();
    expect(screen.getByText("Вы можете помочь здесь")).toBeInTheDocument();
    expect(screen.getByText("Станьте частью волонтерского сообщества")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetEvents).toHaveBeenCalledWith({
        page: 1,
        limit: 100,
        category: "",
        urgent: "",
      });
    });
  });

  it("renders loaded event data", async () => {
    mockGetEvents.mockResolvedValueOnce(
      createEventsResponse([
        makeEvent({
          id: 1,
          title: "Экологическая акция в парке",
          category_name: "Экология",
          start_at: "2099-06-15T10:00:00.000Z",
          location: "Центральный парк",
          available_slots: 12,
          participant_limit: 20,
          image_url: "data:image/png;base64,event-image",
        }),
        makeEvent({
          id: 2,
          title: "Помощь детям",
          category_name: "Детям",
          start_at: "2099-07-10T10:00:00.000Z",
          location: "Детский центр",
          available_slots: 8,
          participant_limit: 15,
        }),
        makeEvent({
          id: 3,
          title: "Помощь приюту",
          category_name: "Животным",
          start_at: "2099-08-01T10:00:00.000Z",
          location: "Приют",
          available_slots: 5,
          participant_limit: 10,
        }),
        makeEvent({
          id: 4,
          title: "Поддержка пожилых",
          category_name: "Пожилым",
          start_at: "2099-09-01T10:00:00.000Z",
          location: "Дом ветеранов",
          available_slots: 6,
          participant_limit: 12,
        }),
      ])
    );

    renderPage();

    await expectTextLoaded("Экологическая акция в парке");
    expectTextVisible("Помощь детям");
    expectTextVisible("Помощь приюту");
    expectTextVisible("Поддержка пожилых");

    expectTextVisible("Центральный парк");
    expectTextVisible("12 из 20");

    const detailsLinks = screen.getAllByRole("link", { name: "Подробнее" });

    expect(detailsLinks.some((link) => link.getAttribute("href") === "/events/1")).toBe(
      true
    );
  });

  it("changes hero slide on dot click", async () => {
    mockGetEvents.mockResolvedValueOnce(
      createEventsResponse([
        makeEvent({
          id: 1,
          title: "Экологическая акция",
          category_name: "Экология",
          start_at: "2099-06-15T10:00:00.000Z",
          location: "Парк",
        }),
        makeEvent({
          id: 2,
          title: "Детский праздник",
          category_name: "Детям",
          start_at: "2099-07-15T10:00:00.000Z",
          location: "Детский центр",
        }),
        makeEvent({
          id: 3,
          title: "Помощь животным",
          category_name: "Животным",
          start_at: "2099-08-15T10:00:00.000Z",
          location: "Приют",
        }),
        makeEvent({
          id: 4,
          title: "Забота о пожилых",
          category_name: "Пожилым",
          start_at: "2099-09-15T10:00:00.000Z",
          location: "Дом ветеранов",
        }),
      ])
    );

    renderPage();

    await expectTextLoaded("Экологическая акция");

    fireEvent.click(screen.getByRole("button", { name: "Слайд 2" }));

    await waitFor(
      () => {
        expect(screen.getAllByText("Детский праздник").length).toBeGreaterThan(0);
      },
      { timeout: 1500 }
    );

    expectTextVisible("Детский центр");
  });

  it("falls back to all events and uses default category for unknown category name", async () => {
    mockGetEvents.mockResolvedValueOnce(
      createEventsResponse([
        makeEvent({
          id: 10,
          title: "Неизвестная категория",
          category_name: "Спорт",
          start_at: "2099-06-15T10:00:00.000Z",
          location: "Городская площадь",
          available_slots: 3,
          participant_limit: 9,
        }),
      ])
    );

    renderPage();

    await expectTextLoaded("Неизвестная категория");
    expectTextVisible("Городская площадь");

    expect(screen.getAllByText("Экология").length).toBeGreaterThan(0);
    expectTextVisible("3 из 9");
  });

  it("logs error when home events request fails", async () => {
    const error = new Error("Ошибка загрузки");

    mockGetEvents.mockRejectedValueOnce(error);

    renderPage();

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Не удалось загрузить мероприятия:",
        error
      );
    });
  });

  it("fills hero slides with remaining events when preferred categories are missing", async () => {
    mockGetEvents.mockResolvedValueOnce(
      createEventsResponse([
        makeEvent({
          id: 1,
          title: "Первое экологическое",
          category_name: "Экология",
          start_at: "2099-06-15T10:00:00.000Z",
          location: "Парк 1",
        }),
        makeEvent({
          id: 2,
          title: "Второе экологическое",
          category_name: "Экология",
          start_at: "2099-07-15T10:00:00.000Z",
          location: "Парк 2",
        }),
        makeEvent({
          id: 3,
          title: "Третье экологическое",
          category_name: "Экология",
          start_at: "2099-08-15T10:00:00.000Z",
          location: "Парк 3",
        }),
        makeEvent({
          id: 4,
          title: "Четвертое экологическое",
          category_name: "Экология",
          start_at: "2099-09-15T10:00:00.000Z",
          location: "Парк 4",
        }),
      ])
    );

    renderPage();

    await expectTextLoaded("Первое экологическое");
    expectTextVisible("Второе экологическое");
    expectTextVisible("Третье экологическое");
    expectTextVisible("Четвертое экологическое");

    expect(screen.getByRole("button", { name: "Слайд 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Слайд 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Слайд 3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Слайд 4" })).toBeInTheDocument();
  });
});
