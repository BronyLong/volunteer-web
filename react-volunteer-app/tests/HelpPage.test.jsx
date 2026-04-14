import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import HelpPage from "../src/pages/HelpPage";

describe("HelpPage", () => {
  it("renders page", () => {
    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <HelpPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/помощь/i)).toBeInTheDocument();
  });
});