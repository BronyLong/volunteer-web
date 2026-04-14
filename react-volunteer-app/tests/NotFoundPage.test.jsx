import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import NotFoundPage from "../src/pages/NotFoundPage";

describe("NotFoundPage", () => {
  it("renders 404 page", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/404/i)).toBeInTheDocument();
  });

  it("has link to home", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("link", { name: /главн/i })
    ).toBeInTheDocument();
  });
});