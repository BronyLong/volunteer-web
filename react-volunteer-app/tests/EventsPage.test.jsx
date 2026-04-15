import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EventsPage from "../src/pages/EventsPage";

const mockApiFetch = vi.fn();

vi.mock("../src/api", () => ({
  apiFetch: (...args) => mockApiFetch(...args),
}));

vi.mock("../src/components/EventCard", () => ({
  default: ({ title, date, location, places, link, category }) => (
    <div data-testid="event-card">
      <div>{title}</div>
      <div>{date}</div>
      <div>{location}</div>
      <div>{places}</div>
      <div>{category}</div>
      <a href={link}>Открыть</a>
    </div>
  ),
}));

function renderPage() {
  return render(
    <MemoryRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <EventsPage />
    </MemoryRouter>
  );
}

describe("EventsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("loads and renders only upcoming events", async () => {
    mockApiFetch.mockResolvedValue([
      {
        id: 1,
        title: "Будущее мероприятие",
        start_at: "2099-05-10T10:00:00.000Z",
        location: "Москва",
        available_slots: 5,
        participant_limit: 20,
        category_name: "Экология",
      },
      {
        id: 2,
        title: "Прошедшее мероприятие",
        start_at: "2000-05-10T10:00:00.000Z",
        location: "Казань",
        available_slots: 0,
        participant_limit: 10,
        category_name: "Детям",
      },
    ]);

    renderPage();

    expect(await screen.findByText("Будущее мероприятие")).toBeInTheDocument();
    expect(screen.queryByText("Прошедшее мероприятие")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/events");
    });
  });

  it("sorts upcoming events by nearest date and ignores invalid dates", async () => {
    mockApiFetch.mockResolvedValue([
      {
        id: 3,
        title: "Позднее мероприятие",
        start_at: "2099-06-20T10:00:00.000Z",
        location: "Самара",
        available_slots: 4,
        participant_limit: 15,
        category_name: "Животным",
      },
      {
        id: 1,
        title: "Ближайшее мероприятие",
        start_at: "2099-05-10T10:00:00.000Z",
        location: "Москва",
        available_slots: 5,
        participant_limit: 20,
        category_name: "Экология",
      },
      {
        id: 2,
        title: "Некорректная дата",
        start_at: "not-a-date",
        location: "Казань",
        available_slots: 2,
        participant_limit: 12,
        category_name: "Детям",
      },
    ]);

    renderPage();

    const cards = await screen.findAllByTestId("event-card");

    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Ближайшее мероприятие");
    expect(cards[1]).toHaveTextContent("Позднее мероприятие");
    expect(screen.queryByText("Некорректная дата")).not.toBeInTheDocument();
  });

  it("maps category names to EventCard category types", async () => {
    mockApiFetch.mockResolvedValue([
      {
        id: 1,
        title: "Экология 1",
        start_at: "2099-05-10T10:00:00.000Z",
        location: "Москва",
        available_slots: 5,
        participant_limit: 20,
        category_name: "Экология",
      },
      {
        id: 2,
        title: "Детям 1",
        start_at: "2099-05-11T10:00:00.000Z",
        location: "Казань",
        available_slots: 2,
        participant_limit: 12,
        category_name: "Детям",
      },
      {
        id: 3,
        title: "Животным 1",
        start_at: "2099-05-12T10:00:00.000Z",
        location: "Уфа",
        available_slots: 3,
        participant_limit: 10,
        category_name: "Животным",
      },
      {
        id: 4,
        title: "Пожилым 1",
        start_at: "2099-05-13T10:00:00.000Z",
        location: "Тверь",
        available_slots: 1,
        participant_limit: 8,
        category_name: "Пожилым",
      },
    ]);

    renderPage();

    expect(await screen.findByText("Экология 1")).toBeInTheDocument();
    expect(screen.getByText("Детям 1")).toBeInTheDocument();
    expect(screen.getByText("Животным 1")).toBeInTheDocument();
    expect(screen.getByText("Пожилым 1")).toBeInTheDocument();

    const cards = screen.getAllByTestId("event-card");
    expect(cards[0]).toHaveTextContent("ecology");
    expect(cards[1]).toHaveTextContent("children");
    expect(cards[2]).toHaveTextContent("animals");
    expect(cards[3]).toHaveTextContent("elderly");
  });

  it("filters events by category", async () => {
    mockApiFetch.mockResolvedValue([
      {
        id: 1,
        title: "Экология 1",
        start_at: "2099-05-10T10:00:00.000Z",
        location: "Москва",
        available_slots: 5,
        participant_limit: 20,
        category_name: "Экология",
      },
      {
        id: 2,
        title: "Детям 1",
        start_at: "2099-05-11T10:00:00.000Z",
        location: "Казань",
        available_slots: 2,
        participant_limit: 12,
        category_name: "Детям",
      },
    ]);

    renderPage();

    expect(await screen.findByText("Экология 1")).toBeInTheDocument();
    expect(screen.getByText("Детям 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /детям/i }));

    expect(screen.queryByText("Экология 1")).not.toBeInTheDocument();
    expect(screen.getByText("Детям 1")).toBeInTheDocument();
  });

  it("shows empty state for category without events", async () => {
    mockApiFetch.mockResolvedValue([
      {
        id: 1,
        title: "Экология 1",
        start_at: "2099-05-10T10:00:00.000Z",
        location: "Москва",
        available_slots: 5,
        participant_limit: 20,
        category_name: "Экология",
      },
    ]);

    renderPage();

    expect(await screen.findByText("Экология 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /детям/i }));

    expect(
      screen.getByText(/по выбранной категории мероприятий пока нет/i)
    ).toBeInTheDocument();
  });

  it("resets to first page when filter changes", async () => {
    const events = [
      ...Array.from({ length: 7 }, (_, index) => ({
        id: index + 1,
        title: `Экология ${index + 1}`,
        start_at: `2099-05-${String(index + 10).padStart(2, "0")}T10:00:00.000Z`,
        location: "Москва",
        available_slots: 5,
        participant_limit: 20,
        category_name: "Экология",
      })),
      {
        id: 100,
        title: "Детям 1",
        start_at: "2099-06-01T10:00:00.000Z",
        location: "Казань",
        available_slots: 2,
        participant_limit: 12,
        category_name: "Детям",
      },
    ];

    mockApiFetch.mockResolvedValue(events);

    renderPage();

    expect(await screen.findByText("Экология 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "2" }));

    expect(await screen.findByText("Экология 7")).toBeInTheDocument();
    expect(screen.queryByText("Экология 1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /детям/i }));

    expect(await screen.findByText("Детям 1")).toBeInTheDocument();
    expect(screen.queryByText("Экология 7")).not.toBeInTheDocument();
  });

  it("renders pagination, next group and back to start buttons", async () => {
    const events = Array.from({ length: 31 }, (_, index) => ({
      id: index + 1,
      title: `Мероприятие ${index + 1}`,
      start_at: `2099-05-${String((index % 20) + 10).padStart(2, "0")}T10:00:00.000Z`,
      location: "Москва",
      available_slots: 5,
      participant_limit: 20,
      category_name: index % 2 === 0 ? "Экология" : "Детям",
    }));

    mockApiFetch.mockResolvedValue(events);

    renderPage();

    expect(await screen.findByText("Мероприятие 1")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /дальше/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /дальше/i }));

    expect(await screen.findByRole("button", { name: "6" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /в начало/i })).toBeInTheDocument();

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });

    fireEvent.click(screen.getByRole("button", { name: /в начало/i }));

    expect(await screen.findByRole("button", { name: "1" })).toBeInTheDocument();
  });

  it("changes page and scrolls to top", async () => {
    const events = Array.from({ length: 7 }, (_, index) => ({
      id: index + 1,
      title: `Мероприятие ${index + 1}`,
      start_at: `2099-05-${String(index + 10).padStart(2, "0")}T10:00:00.000Z`,
      location: "Москва",
      available_slots: 5,
      participant_limit: 20,
      category_name: "Экология",
    }));

    mockApiFetch.mockResolvedValue(events);

    renderPage();

    expect(await screen.findByText("Мероприятие 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "2" }));

    expect(await screen.findByText("Мероприятие 7")).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });
  });

  it("logs api error when loading fails", async () => {
    mockApiFetch.mockRejectedValue(new Error("Ошибка загрузки мероприятий"));

    renderPage();

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith("Ошибка загрузки мероприятий");
    });
  });
});