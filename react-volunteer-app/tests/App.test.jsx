import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "../src/App";

vi.mock("../src/layouts/MainLayout", () => ({
  default: () => (
    <div>
      <div>MainLayout</div>
      <Outlet />
    </div>
  ),
}));

vi.mock("../src/pages/HomePage", () => ({
  default: () => <div>HomePage</div>,
}));

vi.mock("../src/pages/EventsPage", () => ({
  default: () => <div>EventsPage</div>,
}));

vi.mock("../src/pages/LoginPage", () => ({
  default: () => <div>LoginPage</div>,
}));

vi.mock("../src/pages/RegisterPage", () => ({
  default: () => <div>RegisterPage</div>,
}));

vi.mock("../src/pages/ProfilePage", () => ({
  default: () => <div>ProfilePage</div>,
}));

vi.mock("../src/pages/NotFoundPage", () => ({
  default: () => <div>NotFoundPage</div>,
}));

vi.mock("../src/pages/HelpPage", () => ({
  default: () => <div>HelpPage</div>,
}));

vi.mock("../src/pages/EventOpenPage", () => ({
  default: () => <div>EventOpenPage</div>,
}));

vi.mock("../src/pages/ProfileSettings", () => ({
  default: () => <div>ProfileSettings</div>,
}));

vi.mock("../src/pages/EventEditPage", () => ({
  default: () => <div>EventEditPage</div>,
}));

vi.mock("../src/pages/EventCreatePage", () => ({
  default: () => <div>EventCreatePage</div>,
}));

describe("App", () => {
  it("renders home route inside layout", () => {
    render(
      <MemoryRouter
        initialEntries={["/"]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("MainLayout")).toBeInTheDocument();
    expect(screen.getByText("HomePage")).toBeInTheDocument();
  });

  it("renders events route", () => {
    render(
      <MemoryRouter
        initialEntries={["/events"]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("EventsPage")).toBeInTheDocument();
  });

  it("renders login route", () => {
    render(
      <MemoryRouter
        initialEntries={["/login"]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("LoginPage")).toBeInTheDocument();
  });

  it("renders register route", () => {
    render(
      <MemoryRouter
        initialEntries={["/register"]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("RegisterPage")).toBeInTheDocument();
  });

  it("renders help route", () => {
    render(
      <MemoryRouter
        initialEntries={["/help"]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("HelpPage")).toBeInTheDocument();
  });

  it("renders create route", () => {
    render(
      <MemoryRouter
        initialEntries={["/create"]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("EventCreatePage")).toBeInTheDocument();
  });

  it("renders event details route", () => {
    render(
      <MemoryRouter
        initialEntries={["/events/12"]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("EventOpenPage")).toBeInTheDocument();
  });

  it("renders event edit route", () => {
    render(
      <MemoryRouter
        initialEntries={["/events/12/edit"]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("EventEditPage")).toBeInTheDocument();
  });

  it("renders profile route", () => {
    render(
      <MemoryRouter
        initialEntries={["/profiles/7"]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("ProfilePage")).toBeInTheDocument();
  });

  it("renders profile settings route", () => {
    render(
      <MemoryRouter
        initialEntries={["/profiles/7/settings"]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("ProfileSettings")).toBeInTheDocument();
  });

  it("renders not found route for unknown path", () => {
    render(
      <MemoryRouter
        initialEntries={["/unknown-route"]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("NotFoundPage")).toBeInTheDocument();
  });
});