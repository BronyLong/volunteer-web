import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ScrollToTop from "../src/components/ScrollToTop";
import { describe, it, vi, expect } from "vitest";

describe("ScrollToTop", () => {
  it("calls window.scrollTo on route change", () => {
    const scrollToMock = vi.fn();
    window.scrollTo = scrollToMock;

    render(
      <MemoryRouter
        initialEntries={["/"]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ScrollToTop />
      </MemoryRouter>
    );

    expect(scrollToMock).toHaveBeenCalledWith(0, 0);
  });
});