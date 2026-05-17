import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import ProfileEventCard from "../src/components/ProfileEventCard";

describe("ProfileEventCard", () => {
  it("renders component", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ProfileEventCard />
      </MemoryRouter>
    );

    expect(screen.getByRole("link")).toBeInTheDocument();
  });

  it("renders confirmation status badge", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ProfileEventCard
          confirmationStatus={{ type: "success", label: "Участие подтверждено" }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Участие подтверждено")).toHaveClass(
      "profile-event-card__confirmation--success"
    );
  });
});
