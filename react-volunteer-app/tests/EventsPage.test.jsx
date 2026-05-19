import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EventsPage from "../src/pages/EventsPage";

const mockGetEvents = vi.fn();
const mockGetToken = vi.fn();
const mockGetMyProfile = vi.fn();

vi.mock("../src/api", () => ({
  getEvents: (...args) => mockGetEvents(...args),
  getToken: (...args) => mockGetToken(...args),
  getMyProfile: (...args) => mockGetMyProfile(...args),
}));

vi.mock("../src/components/EventCard", () => ({
  default: ({ title, date, location, places, link, category, isUrgent }) => (
    <div data-testid="event-card">
      <div>{title}</div>
      <div>{date}</div>
      <div>{location}</div>
      <div>{places}</div>
      <div>{category}</div>
      <div>{isUrgent ? "urgent" : "not-urgent"}</div>
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

function createPaginationResponse(
  items,
  {
    page = 1,
    limit = 6,
    total = items.length,
    totalPages = Math.max(1, Math.ceil(total / limit)),
  } = {}
) {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      total_pages: totalPages,
      has_next_page: page < totalPages,
      has_prev_page: page > 1,
    },
  };
}

describe("EventsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();

    mockGetToken.mockReturnValue(null);
    mockGetMyProfile.mockResolvedValue({
      id: 1,
      role: "volunteer",
    });

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("loads and renders events from server pagination response", async () => {
    mockGetEvents.mockResolvedValue(
      createPaginationResponse([
        {
          id: 1,
          title: "Будущее мероприятие",
          start_at: "2099-05-10T10:00:00.000Z",
          location: "Москва",
          available_slots: 5,
          participant_limit: 20,
          category_name: "Экология",
        },
      ])
    );

    renderPage();

    expect(await screen.findByText("Будущее мероприятие")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetEvents).toHaveBeenCalledWith({
        page: 1,
        limit: 6,
        category: "",
        urgent: "",
      });
    });
  });

  it("renders events in the order returned by the server", async () => {
    mockGetEvents.mockResolvedValue(
      createPaginationResponse([
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
          id: 3,
          title: "Позднее мероприятие",
          start_at: "2099-06-20T10:00:00.000Z",
          location: "Самара",
          available_slots: 4,
          participant_limit: 15,
          category_name: "Животным",
        },
      ])
    );

    renderPage();

    const cards = await screen.findAllByTestId("event-card");

    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Ближайшее мероприятие");
    expect(cards[1]).toHaveTextContent("Позднее мероприятие");
  });

  it("maps category names to EventCard category types", async () => {
    mockGetEvents.mockResolvedValue(
      createPaginationResponse([
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
      ])
    );

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

  it("requests events by category when filter changes", async () => {
    mockGetEvents
      .mockResolvedValueOnce(
        createPaginationResponse([
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
        ])
      )
      .mockResolvedValueOnce(
        createPaginationResponse([
          {
            id: 2,
            title: "Детям 1",
            start_at: "2099-05-11T10:00:00.000Z",
            location: "Казань",
            available_slots: 2,
            participant_limit: 12,
            category_name: "Детям",
          },
        ])
      );

    renderPage();

    expect(await screen.findByText("Экология 1")).toBeInTheDocument();
    expect(screen.getByText("Детям 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /детям/i }));

    await waitFor(() => {
      expect(mockGetEvents).toHaveBeenLastCalledWith({
        page: 1,
        limit: 6,
        category: "Детям",
        urgent: "",
      });
    });

    expect(await screen.findByText("Детям 1")).toBeInTheDocument();
    expect(screen.queryByText("Экология 1")).not.toBeInTheDocument();
  });

  it("shows empty state for category without events", async () => {
    mockGetEvents
      .mockResolvedValueOnce(
        createPaginationResponse([
          {
            id: 1,
            title: "Экология 1",
            start_at: "2099-05-10T10:00:00.000Z",
            location: "Москва",
            available_slots: 5,
            participant_limit: 20,
            category_name: "Экология",
          },
        ])
      )
      .mockResolvedValueOnce(createPaginationResponse([]));

    renderPage();

    expect(await screen.findByText("Экология 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /детям/i }));

    expect(
      await screen.findByText(/по выбранным фильтрам мероприятий пока нет/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetEvents).toHaveBeenLastCalledWith({
        page: 1,
        limit: 6,
        category: "Детям",
        urgent: "",
      });
    });
  });

  it("resets to first page when category filter changes", async () => {
    mockGetEvents
      .mockResolvedValueOnce(
        createPaginationResponse(
          Array.from({ length: 6 }, (_, index) => ({
            id: index + 1,
            title: `Экология ${index + 1}`,
            start_at: `2099-05-${String(index + 10).padStart(2, "0")}T10:00:00.000Z`,
            location: "Москва",
            available_slots: 5,
            participant_limit: 20,
            category_name: "Экология",
          })),
          {
            page: 1,
            total: 7,
            totalPages: 2,
          }
        )
      )
      .mockResolvedValueOnce(
        createPaginationResponse(
          [
            {
              id: 7,
              title: "Экология 7",
              start_at: "2099-05-16T10:00:00.000Z",
              location: "Москва",
              available_slots: 5,
              participant_limit: 20,
              category_name: "Экология",
            },
          ],
          {
            page: 2,
            total: 7,
            totalPages: 2,
          }
        )
      )
      .mockResolvedValueOnce(
        createPaginationResponse([
          {
            id: 100,
            title: "Детям 1",
            start_at: "2099-06-01T10:00:00.000Z",
            location: "Казань",
            available_slots: 2,
            participant_limit: 12,
            category_name: "Детям",
          },
        ])
      );

    renderPage();

    expect(await screen.findByText("Экология 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "2" }));

    expect(await screen.findByText("Экология 7")).toBeInTheDocument();
    expect(screen.queryByText("Экология 1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /детям/i }));

    expect(await screen.findByText("Детям 1")).toBeInTheDocument();
    expect(screen.queryByText("Экология 7")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetEvents).toHaveBeenLastCalledWith({
        page: 1,
        limit: 6,
        category: "Детям",
        urgent: "",
      });
    });
  });

  it("renders pagination, next group and back to start buttons", async () => {
    mockGetEvents
      .mockResolvedValueOnce(
        createPaginationResponse(
          Array.from({ length: 6 }, (_, index) => ({
            id: index + 1,
            title: `Мероприятие ${index + 1}`,
            start_at: `2099-05-${String(index + 10).padStart(2, "0")}T10:00:00.000Z`,
            location: "Москва",
            available_slots: 5,
            participant_limit: 20,
            category_name: index % 2 === 0 ? "Экология" : "Детям",
          })),
          {
            page: 1,
            total: 31,
            totalPages: 6,
          }
        )
      )
      .mockResolvedValueOnce(
        createPaginationResponse(
          [
            {
              id: 31,
              title: "Мероприятие 31",
              start_at: "2099-06-10T10:00:00.000Z",
              location: "Москва",
              available_slots: 5,
              participant_limit: 20,
              category_name: "Экология",
            },
          ],
          {
            page: 6,
            total: 31,
            totalPages: 6,
          }
        )
      )
      .mockResolvedValueOnce(
        createPaginationResponse(
          Array.from({ length: 6 }, (_, index) => ({
            id: index + 1,
            title: `Мероприятие ${index + 1}`,
            start_at: `2099-05-${String(index + 10).padStart(2, "0")}T10:00:00.000Z`,
            location: "Москва",
            available_slots: 5,
            participant_limit: 20,
            category_name: index % 2 === 0 ? "Экология" : "Детям",
          })),
          {
            page: 1,
            total: 31,
            totalPages: 6,
          }
        )
      );

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
    mockGetEvents
      .mockResolvedValueOnce(
        createPaginationResponse(
          Array.from({ length: 6 }, (_, index) => ({
            id: index + 1,
            title: `Мероприятие ${index + 1}`,
            start_at: `2099-05-${String(index + 10).padStart(2, "0")}T10:00:00.000Z`,
            location: "Москва",
            available_slots: 5,
            participant_limit: 20,
            category_name: "Экология",
          })),
          {
            page: 1,
            total: 7,
            totalPages: 2,
          }
        )
      )
      .mockResolvedValueOnce(
        createPaginationResponse(
          [
            {
              id: 7,
              title: "Мероприятие 7",
              start_at: "2099-05-16T10:00:00.000Z",
              location: "Москва",
              available_slots: 5,
              participant_limit: 20,
              category_name: "Экология",
            },
          ],
          {
            page: 2,
            total: 7,
            totalPages: 2,
          }
        )
      );

    renderPage();

    expect(await screen.findByText("Мероприятие 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "2" }));

    expect(await screen.findByText("Мероприятие 7")).toBeInTheDocument();

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });

    await waitFor(() => {
      expect(mockGetEvents).toHaveBeenLastCalledWith({
        page: 2,
        limit: 6,
        category: "",
        urgent: "",
      });
    });
  });

  it("shows create panel for coordinator profile", async () => {
    mockGetToken.mockReturnValue("token");
    mockGetMyProfile.mockResolvedValue({
      id: 2,
      role: "coordinator",
    });

    mockGetEvents.mockResolvedValue(
      createPaginationResponse([
        {
          id: 1,
          title: "Координаторское мероприятие",
          start_at: "2099-05-10T10:00:00.000Z",
          location: "Москва",
          available_slots: 5,
          participant_limit: 20,
          category_name: "Экология",
        },
      ])
    );

    renderPage();

    expect(await screen.findByText("Координаторское мероприятие")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /создание мероприятия/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /создать мероприятие/i })).toHaveAttribute(
      "href",
      "/create"
    );
    expect(mockGetMyProfile).toHaveBeenCalledTimes(1);
  });

  it("hides create panel when authorized profile loading fails", async () => {
    mockGetToken.mockReturnValue("token");
    mockGetMyProfile.mockRejectedValue(new Error("profile failed"));

    mockGetEvents.mockResolvedValue(
      createPaginationResponse([
        {
          id: 1,
          title: "Обычное мероприятие",
          start_at: "2099-05-10T10:00:00.000Z",
          location: "Москва",
          available_slots: 5,
          participant_limit: 20,
          category_name: "Экология",
        },
      ])
    );

    renderPage();

    expect(await screen.findByText("Обычное мероприятие")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /создание мероприятия/i })).not.toBeInTheDocument();
  });

  it("filters urgent events and resets pagination", async () => {
    mockGetEvents
      .mockResolvedValueOnce(
        createPaginationResponse(
          Array.from({ length: 6 }, (_, index) => ({
            id: index + 1,
            title: `Несрочное ${index + 1}`,
            start_at: `2099-05-${String(index + 10).padStart(2, "0")}T10:00:00.000Z`,
            location: "Москва",
            available_slots: 5,
            participant_limit: 20,
            category_name: "Экология",
            is_urgent: false,
          })),
          {
            page: 1,
            total: 7,
            totalPages: 2,
          }
        )
      )
      .mockResolvedValueOnce(
        createPaginationResponse(
          [
            {
              id: 7,
              title: "Несрочное 7",
              start_at: "2099-05-16T10:00:00.000Z",
              location: "Москва",
              available_slots: 5,
              participant_limit: 20,
              category_name: "Экология",
              is_urgent: false,
            },
          ],
          {
            page: 2,
            total: 7,
            totalPages: 2,
          }
        )
      )
      .mockResolvedValueOnce(
        createPaginationResponse([
          {
            id: 100,
            title: "Срочное мероприятие",
            start_at: "2099-06-01T10:00:00.000Z",
            location: "Казань",
            available_slots: 2,
            participant_limit: 12,
            category_name: "Детям",
            is_urgent: true,
          },
        ])
      );

    renderPage();

    expect(await screen.findByText("Несрочное 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "2" }));

    expect(await screen.findByText("Несрочное 7")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /срочные/i }));

    expect(await screen.findByText("Срочное мероприятие")).toBeInTheDocument();
    expect(screen.queryByText("Несрочное 7")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetEvents).toHaveBeenLastCalledWith({
        page: 1,
        limit: 6,
        category: "",
        urgent: "true",
      });
    });
  });

  it("logs api error when loading fails", async () => {
    mockGetEvents.mockRejectedValue(new Error("Ошибка загрузки мероприятий"));

    renderPage();

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith("Ошибка загрузки мероприятий");
    });
  });
});
