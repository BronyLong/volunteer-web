import { describe, it, expect } from "vitest";
import {
  INITIAL_PROFILE_FIELD_ERRORS,
  getRoleLabel,
  mapProfileToForm,
  normalizeEmail,
  validateEmail,
  formatRussianPhone,
  validateRussianPhone,
  validateVkLink,
  validateOkLink,
  validateMaxLink,
  getFieldClassName,
  buildValidationErrors,
  hasValidationErrors,
} from "../src/utils/profileUtils";

describe("profileUtils", () => {
  describe("getRoleLabel", () => {
    it("returns admin label", () => {
      expect(getRoleLabel("admin")).toBe("Администратор");
    });

    it("returns coordinator label", () => {
      expect(getRoleLabel("coordinator")).toBe("Координатор");
    });

    it("returns volunteer label", () => {
      expect(getRoleLabel("volunteer")).toBe("Волонтер");
    });

    it("returns default label for unknown role", () => {
      expect(getRoleLabel("guest")).toBe("Пользователь");
    });
  });

  describe("mapProfileToForm", () => {
    it("maps profile fields correctly", () => {
      const profile = {
        first_name: "Иван",
        last_name: "Иванов",
        email: "ivan@example.com",
        phone: "+7 (999) 123-45-67",
        city: "Москва",
        bio: "О себе",
        social_vk: "https://vk.com/test",
        social_ok: "https://ok.ru/profile/123",
        social_max: "https://max.ru/test",
      };

      expect(mapProfileToForm(profile)).toEqual(profile);
    });

    it("returns empty strings for missing fields", () => {
      expect(mapProfileToForm(null)).toEqual({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        city: "",
        bio: "",
        social_vk: "",
        social_ok: "",
        social_max: "",
      });
    });
  });

  describe("normalizeEmail", () => {
    it("trims and lowercases email", () => {
      expect(normalizeEmail("  TEST@MAIL.COM  ")).toBe("test@mail.com");
    });

    it("returns empty string for empty value", () => {
      expect(normalizeEmail("")).toBe("");
    });
  });

  describe("validateEmail", () => {
    it("accepts valid email", () => {
      expect(validateEmail("user@example.com")).toBe(true);
    });

    it("rejects invalid email", () => {
      expect(validateEmail("wrong-email")).toBe(false);
    });
  });

  describe("formatRussianPhone", () => {
    it("formats phone starting with 8", () => {
      expect(formatRussianPhone("89991234567")).toBe("+7 (999) 123-45-67");
    });

    it("formats phone starting with 7", () => {
      expect(formatRussianPhone("79991234567")).toBe("+7 (999) 123-45-67");
    });

    it("adds 7 if phone starts with another digit", () => {
      expect(formatRussianPhone("9991234567")).toBe("+7 (999) 123-45-67");
    });

    it("returns empty string for empty input", () => {
      expect(formatRussianPhone("")).toBe("");
    });
  });

  describe("validateRussianPhone", () => {
    it("accepts valid russian phone", () => {
      expect(validateRussianPhone("+7 (999) 123-45-67")).toBe(true);
    });

    it("rejects invalid phone", () => {
      expect(validateRussianPhone("+7 (999) 123-45")).toBe(false);
      expect(validateRussianPhone("123")).toBe(false);
    });

    it("rejects 11-digit phone that does not start with 7", () => {
      expect(validateRussianPhone("89991234567")).toBe(false);
    });

    it("allows empty phone", () => {
      expect(validateRussianPhone("")).toBe(true);
    });
  });

  describe("formatRussianPhone short branches", () => {
    it("formats one-digit phone", () => {
      expect(formatRussianPhone("7")).toBe("+7");
    });

    it("formats short phone up to 4 digits", () => {
      expect(formatRussianPhone("7999")).toBe("+7 (999)");
    });
    it("formats phone when first group is shorter than 3 digits", () => {
      expect(formatRussianPhone("79")).toBe("+7 (9");
      expect(formatRussianPhone("799")).toBe("+7 (99");
    });

    it("formats short phone up to 7 digits", () => {
      expect(formatRussianPhone("79991")).toBe("+7 (999) 1");
      expect(formatRussianPhone("7999123")).toBe("+7 (999) 123");
    });

    it("formats short phone up to 9 digits", () => {
      expect(formatRussianPhone("79991234")).toBe("+7 (999) 123-4");
      expect(formatRussianPhone("799912345")).toBe("+7 (999) 123-45");
    });
  });

  describe("social link validators", () => {
    it("accepts valid VK link", () => {
      expect(validateVkLink("https://vk.com/test_user")).toBe(true);
    });

    it("rejects invalid VK link", () => {
      expect(validateVkLink("https://google.com/test_user")).toBe(false);
    });

    it("accepts valid OK link", () => {
      expect(validateOkLink("https://ok.ru/profile/123")).toBe(true);
    });

    it("rejects invalid OK link", () => {
      expect(validateOkLink("https://vk.com/test")).toBe(false);
    });

    it("accepts valid MAX link", () => {
      expect(validateMaxLink("https://max.ru/test_user")).toBe(true);
    });

    it("rejects invalid MAX link", () => {
      expect(validateMaxLink("https://example.com/test")).toBe(false);
    });

    it("allows empty social links", () => {
      expect(validateVkLink("")).toBe(true);
      expect(validateOkLink("")).toBe(true);
      expect(validateMaxLink("")).toBe(true);
    });
  });

  describe("social link validators with spaces", () => {
    it("rejects VK link with surrounding spaces", () => {
      expect(validateVkLink("  https://vk.com/test  ")).toBe(false);
    });
  
    it("rejects OK link with surrounding spaces", () => {
      expect(validateOkLink("  https://ok.ru/profile/123  ")).toBe(false);
    });
  
    it("rejects MAX link with surrounding spaces", () => {
      expect(validateMaxLink("  https://max.ru/test  ")).toBe(false);
    });
  });


  describe("getFieldClassName", () => {
    it("returns error class when field has error", () => {
      expect(getFieldClassName(true)).toBe(
        "form-field__input form-field__input--error"
      );
    });

    it("returns default class when field has no error", () => {
      expect(getFieldClassName(false)).toBe("form-field__input");
    });
  });

  describe("buildValidationErrors", () => {
    it("returns required field errors", () => {
      const result = buildValidationErrors({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        social_vk: "",
        social_ok: "",
        social_max: "",
      });

      expect(result.first_name).toBe("Введите имя");
      expect(result.last_name).toBe("Введите фамилию");
      expect(result.email).toBe("Введите email");
    });

    it("returns email format error", () => {
      const result = buildValidationErrors({
        first_name: "Иван",
        last_name: "Иванов",
        email: "wrong-email",
        phone: "",
        social_vk: "",
        social_ok: "",
        social_max: "",
      });

      expect(result.email).toBe(
        "Введите корректный email, например example@mail.com"
      );
    });

    it("returns phone format error", () => {
      const result = buildValidationErrors({
        first_name: "Иван",
        last_name: "Иванов",
        email: "ivan@example.com",
        phone: "12345",
        social_vk: "",
        social_ok: "",
        social_max: "",
      });

      expect(result.phone).toBe("Введите телефон в формате +7 (900) 000-00-00");
    });

    it("returns social link errors", () => {
      const result = buildValidationErrors({
        first_name: "Иван",
        last_name: "Иванов",
        email: "ivan@example.com",
        phone: "",
        social_vk: "https://google.com/test",
        social_ok: "https://google.com/test",
        social_max: "https://google.com/test",
      });

      expect(result.social_vk).toBe("Укажите корректную ссылку VK");
      expect(result.social_ok).toBe("Укажите корректную ссылку Одноклассников");
      expect(result.social_max).toBe("Укажите корректную ссылку MAX");
    });

    it("returns no errors for valid form", () => {
      const result = buildValidationErrors({
        first_name: "Иван",
        last_name: "Иванов",
        email: "ivan@example.com",
        phone: "+7 (999) 123-45-67",
        social_vk: "https://vk.com/test_user",
        social_ok: "https://ok.ru/profile/123",
        social_max: "https://max.ru/test_user",
      });

      expect(result).toEqual(INITIAL_PROFILE_FIELD_ERRORS);
    });
  });

  describe("hasValidationErrors", () => {
    it("returns true when there is at least one error", () => {
      expect(
        hasValidationErrors({
          first_name: "Введите имя",
          last_name: "",
          email: "",
          phone: "",
          social_vk: "",
          social_ok: "",
          social_max: "",
        })
      ).toBe(true);
    });

    it("returns false when there are no errors", () => {
      expect(hasValidationErrors(INITIAL_PROFILE_FIELD_ERRORS)).toBe(false);
    });
  });
});