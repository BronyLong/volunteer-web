import { render, screen } from "@testing-library/react";
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
          status="active"
          onReject={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Иван Иванов")).toBeInTheDocument();
    expect(screen.getByText("Подана")).toBeInTheDocument();
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
          status="active"
          onReject={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("button", { name: /отклонить заявку/i })
    ).toBeInTheDocument();
  });

  it("renders rejected status and restore button", () => {
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
          onRestore={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/отклонена/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /восстановить заявку/i })
    ).toBeInTheDocument();
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
          status="pending"
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
});