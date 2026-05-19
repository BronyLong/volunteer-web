import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import ApplicationCard from "../src/components/ApplicationCard";

describe("ApplicationCard", () => {
  it("renders applicant full name and status", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ApplicationCard
          id={1}
          userId={12}
          name="Иван"
          secondName="Иванов"
          email="ivan@example.com"
          phone="+7 (999) 123-45-67"
          status="pending"
          onReject={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Иван Иванов")).toBeInTheDocument();
    expect(screen.getByText("Ожидает решения")).toBeInTheDocument();
    expect(screen.getByText("ivan@example.com")).toBeInTheDocument();
    expect(screen.getByText("+7 (999) 123-45-67")).toBeInTheDocument();
  });

  it("renders reject button", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ApplicationCard
          id={1}
          name="Иван"
          secondName="Иванов"
          status="pending"
          onReject={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("button", { name: /отклонить заявку/i })
    ).toBeInTheDocument();
  });

  it("renders rejected status without action buttons", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ApplicationCard
          id={1}
          name="Иван"
          secondName="Иванов"
          status="rejected"
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/отклонена/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /восстановить заявку/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /отклонить заявку/i })
    ).not.toBeInTheDocument();
  });

  it("renders fallback status and avatar without profile link for unknown status", () => {
    const { container } = render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ApplicationCard
          id={1}
          avatar="avatar.jpg"
          name=""
          secondName=""
          email="user@example.com"
          phone="+7 (999) 000-00-00"
          status="unknown"
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Пользователь")).toBeInTheDocument();
    expect(screen.getByText("Неизвестно")).toBeInTheDocument();
    expect(container.querySelector(".application-card__avatar-link")).toBeNull();
    expect(container.querySelector(".application-card__status")).toHaveTextContent(
      "Неизвестно"
    );
  });

  it("renders approved status and calls accept handler", () => {
    const handleAccept = vi.fn();
  
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ApplicationCard
          id={10}
          userId={20}
          avatar="avatar.jpg"
          name="Анна"
          secondName="Смирнова"
          email="anna@example.com"
          phone="+7 (999) 111-22-33"
          status="pending"
          onAccept={handleAccept}
        />
      </MemoryRouter>
    );
  
    fireEvent.click(screen.getByRole("button", { name: /принять заявку/i }));
  
    expect(handleAccept).toHaveBeenCalledWith(10);
  });
  
  it("renders approved application with reject button", () => {
    const handleReject = vi.fn();

    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ApplicationCard
          id={11}
          userId={21}
          avatar="avatar.jpg"
          name="Петр"
          secondName="Петров"
          email="petr@example.com"
          phone="+7 (999) 222-33-44"
          status="approved"
          onReject={handleReject}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/принята/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /принять заявку/i })).not.toBeInTheDocument();

    const rejectButton = screen.getByRole("button", { name: /отклонить принятую заявку/i });
    fireEvent.click(rejectButton);

    expect(handleReject).toHaveBeenCalledWith(11);
  });
  
  it("disables pending action buttons when application changes are not allowed", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ApplicationCard
          id={12}
          avatar="avatar.jpg"
          name="Мария"
          secondName="Иванова"
          email="maria@example.com"
          phone="+7 (999) 333-44-55"
          status="pending"
          canAccept={false}
          canReject={false}
        />
      </MemoryRouter>
    );
  
    expect(screen.getByRole("button", { name: /принять заявку/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /отклонить заявку/i })).toBeDisabled();
  });
});
