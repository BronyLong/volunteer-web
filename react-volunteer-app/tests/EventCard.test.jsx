import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import EventCard from "../src/components/EventCard";

describe("EventCard", () => {
  it("renders passed props", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <EventCard
          title="Тестовое мероприятие"
          date="10.05.2026"
          location="Москва"
          places="5 из 20"
          category="ecology"
          link="/event/1"
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Тестовое мероприятие")).toBeInTheDocument();
    expect(screen.getByText(/10.05.2026/i)).toBeInTheDocument();
    expect(screen.getByText("Москва")).toBeInTheDocument();
    expect(screen.getByText("5 из 20")).toBeInTheDocument();
    expect(screen.getByText("Экология")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /подробнее/i })
    ).toHaveAttribute("href", "/event/1");
  });

  it("renders default content when props are missing", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <EventCard />
      </MemoryRouter>
    );

    expect(
      screen.getByText("Название название название название")
    ).toBeInTheDocument();
    expect(screen.getByText(/1.01.1980/i)).toBeInTheDocument();
    expect(
      screen.getByText("Место проведения место место проведения")
    ).toBeInTheDocument();
    expect(screen.getByText("20 из 20")).toBeInTheDocument();
    expect(screen.getByText("Экология")).toBeInTheDocument();
  });

  it("falls back to ecology category for unknown category type", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <EventCard category="unknown-category" />
      </MemoryRouter>
    );
  
    expect(screen.getByText("Экология")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /подробнее/i })).toHaveClass(
      "event-tile__button--green"
    );
  });
  
  it("renders orange category button for children category", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <EventCard category="children" />
      </MemoryRouter>
    );
  
    expect(screen.getByText("Детям")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /подробнее/i })).toHaveClass(
      "event-tile__button--orange"
    );
  });

  it("renders urgent marker when event is urgent", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <EventCard title="Срочный сбор" isUrgent />
      </MemoryRouter>
    );

    expect(screen.getByText("Срочно")).toBeInTheDocument();
  });
});
