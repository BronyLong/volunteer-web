import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import MainLayout from "../src/layouts/MainLayout";

vi.mock("../src/components/Header", () => ({
  default: () => <div>Mock Header</div>,
}));

vi.mock("../src/components/Footer", () => ({
  default: () => <div>Mock Footer</div>,
}));

describe("MainLayout", () => {
  it("renders header, outlet content and footer", () => {
    render(
      <MemoryRouter
        initialEntries={["/"]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<div>Page Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Mock Header")).toBeInTheDocument();
    expect(screen.getByText("Page Content")).toBeInTheDocument();
    expect(screen.getByText("Mock Footer")).toBeInTheDocument();
  });
});