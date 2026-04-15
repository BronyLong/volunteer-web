import { fireEvent, render, screen, waitFor, within, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "../src/pages/HomePage";

const mockApiFetch = vi.fn();

vi.mock("../src/api", () => ({
  apiFetch: (...args) => mockApiFetch(...args),
}));

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders static content", async () => {
    mockApiFetch.mockResolvedValue([]);

    const { container } = render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <HomePage />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/присоединяйтесь к добрым делам/i)
    ).toBeInTheDocument();

    const eventsLinks = screen.getAllByRole("link", {
      name: /смотреть мероприятия/i,
    });
    expect(eventsLinks.length).toBeGreaterThan(0);
    expect(eventsLinks[0]).toHaveAttribute("href", "/events");

    expect(
      screen.getByText(/как стать волонтером в 4 шага/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/events");
    });

    expect(container.querySelector(".hero")).toBeInTheDocument();
  });

  it("renders loaded event data", async () => {
    mockApiFetch.mockResolvedValue([
      {
        id: 1,
        title: "Экологическая акция",
        start_at: "2099-05-10T10:00:00.000Z",
        location: "Москва",
        available_slots: 5,
        participant_limit: 20,
        category_name: "Экология",
      },
      {
        id: 2,
        title: "Помощь детям",
        start_at: "2099-05-12T10:00:00.000Z",
        location: "Казань",
        available_slots: 3,
        participant_limit: 10,
        category_name: "Детям",
      },
    ]);

    const { container } = render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/events");
    });

    const heroTitle = container.querySelector(".hero__event-title");
    expect(heroTitle).toBeTruthy();
    expect(heroTitle.textContent).toBe("Экологическая акция");

    const heroCard = container.querySelector(".hero__event-card-content--visible");
    expect(heroCard).toBeTruthy();

    expect(within(heroCard).getByText(/москва/i)).toBeInTheDocument();
    expect(within(heroCard).getByText(/5 из 20/i)).toBeInTheDocument();

    const detailLinks = screen.getAllByRole("link", { name: /подать заявку|подробнее/i });
    expect(detailLinks.length).toBeGreaterThan(0);
    expect(detailLinks[0].getAttribute("href")).toContain("/events/1");
  });

  it("changes hero slide on dot click", async () => {
    mockApiFetch.mockResolvedValue([
      {
        id: 1,
        title: "Экология",
        start_at: "2099-05-10T10:00:00.000Z",
        location: "Москва",
        available_slots: 5,
        participant_limit: 20,
        category_name: "Экология",
      },
      {
        id: 2,
        title: "Детям",
        start_at: "2099-05-11T10:00:00.000Z",
        location: "Тверь",
        available_slots: 4,
        participant_limit: 15,
        category_name: "Детям",
      },
      {
        id: 3,
        title: "Животным",
        start_at: "2099-05-12T10:00:00.000Z",
        location: "Пермь",
        available_slots: 6,
        participant_limit: 12,
        category_name: "Животным",
      },
      {
        id: 4,
        title: "Пожилым",
        start_at: "2099-05-13T10:00:00.000Z",
        location: "Самара",
        available_slots: 7,
        participant_limit: 14,
        category_name: "Пожилым",
      },
    ]);

    const { container } = render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/events");
    });

    await waitFor(() => {
      const heroTitle = container.querySelector(".hero__event-title");
      expect(heroTitle).toBeTruthy();
      expect(heroTitle.textContent).toBe("Экология");
    });

    const dots = screen.getAllByRole("button");
    const slideButtons = dots.filter((button) =>
      /слайд/i.test(button.getAttribute("aria-label") || "")
    );

    expect(slideButtons.length).toBeGreaterThan(1);

    fireEvent.click(slideButtons[1]);

    await waitFor(() => {
      const heroTitle = container.querySelector(".hero__event-title");
      expect(heroTitle).toBeTruthy();
      expect(heroTitle.textContent).toBe("Детям");
    });
  });

  it("falls back to all events and uses default category for unknown category name", async () => {
    mockApiFetch.mockResolvedValue([
      {
        id: 10,
        title: "Без категории",
        start_at: "not-a-date",
        location: "Тула",
        available_slots: null,
        participant_limit: null,
        category_name: "Другое",
      },
    ]);
  
    const { container } = render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <HomePage />
      </MemoryRouter>
    );
  
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/events");
    });
  
    expect(container.querySelector(".hero__event-title")?.textContent).toBe(
      "Без категории"
    );
    expect(screen.getAllByText(/дата не указана/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/0 из 0/i).length).toBeGreaterThan(0);
    expect(container.querySelector(".hero__slider-dots--green")).toBeInTheDocument();
  });
});