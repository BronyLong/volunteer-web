import { describe, it, expect, vi, afterEach } from "vitest";
import {
  formatDate,
  formatTime,
  getCoordinatorName,
  getDisplayValue,
  isEventPast,
} from "../src/utils/eventUtils";

describe("eventUtils", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("formatDate", () => {
    it('returns "Не указано" for empty value', () => {
      expect(formatDate("")).toBe("Не указано");
    });

    it('returns "Не указано" for invalid date', () => {
      expect(formatDate("invalid-date")).toBe("Не указано");
    });

    it("formats valid date", () => {
      expect(formatDate("2026-04-20T10:30:00.000Z")).toBe(
        new Date("2026-04-20T10:30:00.000Z").toLocaleDateString("ru-RU")
      );
    });
  });

  describe("formatTime", () => {
    it('returns "Не указано" for empty value', () => {
      expect(formatTime("")).toBe("Не указано");
    });

    it('returns "Не указано" for invalid date', () => {
      expect(formatTime("invalid-date")).toBe("Не указано");
    });

    it("formats valid time", () => {
      expect(formatTime("2026-04-20T10:30:00.000Z")).toBe(
        new Date("2026-04-20T10:30:00.000Z").toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    });
  });

  describe("getCoordinatorName", () => {
    it("returns full coordinator name", () => {
      expect(
        getCoordinatorName({
          first_name: "Анна",
          last_name: "Петрова",
        })
      ).toBe("Анна Петрова");
    });

    it('returns fallback when coordinator name is missing', () => {
      expect(getCoordinatorName({})).toBe("Координатор не указан");
    });
  });

  describe("getDisplayValue", () => {
    it("returns value when it exists", () => {
      expect(getDisplayValue("Москва")).toBe("Москва");
    });

    it('returns fallback for empty value', () => {
      expect(getDisplayValue("")).toBe("Не указан");
    });

    it('returns fallback for spaces only', () => {
      expect(getDisplayValue("   ")).toBe("Не указан");
    });
  });

  describe("isEventPast", () => {
    it("returns false for empty value", () => {
      expect(isEventPast("")).toBe(false);
    });

    it("returns false for invalid date", () => {
      expect(isEventPast("invalid-date")).toBe(false);
    });

    it("returns true for past event", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-14T12:00:00.000Z"));

      expect(isEventPast("2026-04-13T12:00:00.000Z")).toBe(true);
    });

    it("returns false for future event", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-14T12:00:00.000Z"));

      expect(isEventPast("2026-04-15T12:00:00.000Z")).toBe(false);
    });
  });
});