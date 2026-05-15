import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildEncryptedProfilePayload,
  decryptPersonalData,
  decryptProfilePersonalFields,
  decryptUserPersonalFields,
  decryptUserProfileRow,
  decryptUserProfileRows,
  encryptEmail,
  encryptPersonalData,
  encryptProfilePersonalFields,
  hashPersonalLookupValue,
  isEncryptedValue,
  normalizeEmail,
  sanitizeAuditDetails,
} from "../utils/personalData.js";

const VALID_KEY = Buffer.alloc(32, 1).toString("base64");
const VALID_HASH_KEY = Buffer.alloc(32, 2).toString("base64");

function setValidKeys() {
  process.env.PERSONAL_DATA_ENCRYPTION_KEY = VALID_KEY;
  process.env.PERSONAL_DATA_HASH_KEY = VALID_HASH_KEY;
}

describe("personalData util", () => {
  beforeEach(() => {
    setValidKeys();
  });

  afterEach(() => {
    delete process.env.PERSONAL_DATA_ENCRYPTION_KEY;
    delete process.env.PERSONAL_DATA_HASH_KEY;
  });

  it("normalizes email and detects encrypted values", () => {
    expect(normalizeEmail(" USER@MAIL.RU ")).toBe("user@mail.ru");
    expect(normalizeEmail(null)).toBe("");
    expect(isEncryptedValue("enc:v1:iv:tag:value")).toBe(true);
    expect(isEncryptedValue("plain")).toBe(false);
  });

  it("encrypts and decrypts personal data values", () => {
    const encrypted = encryptPersonalData("Иван");

    expect(encrypted).toMatch(/^enc:v1:/);
    expect(decryptPersonalData(encrypted)).toBe("Иван");
    expect(encryptPersonalData(encrypted)).toBe(encrypted);
    expect(encryptPersonalData(null)).toBeNull();
    expect(encryptPersonalData(undefined)).toBeUndefined();
    expect(encryptPersonalData("")).toBe("");
    expect(decryptPersonalData(null)).toBeNull();
    expect(decryptPersonalData(undefined)).toBeUndefined();
    expect(decryptPersonalData("")).toBe("");
    expect(decryptPersonalData("plain")).toBe("plain");
  });

  it("encrypts email and hashes normalized lookup value", () => {
    const encryptedEmail = encryptEmail(" USER@MAIL.RU ");
    const firstHash = hashPersonalLookupValue(" USER@MAIL.RU ");
    const secondHash = hashPersonalLookupValue("user@mail.ru");

    expect(decryptPersonalData(encryptedEmail)).toBe("user@mail.ru");
    expect(firstHash).toBe(secondHash);
    expect(firstHash).toHaveLength(64);
  });

  it("throws when encryption keys are missing or invalid", () => {
    delete process.env.PERSONAL_DATA_ENCRYPTION_KEY;
    expect(() => encryptPersonalData("value")).toThrow("PERSONAL_DATA_ENCRYPTION_KEY is not set");

    process.env.PERSONAL_DATA_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString("base64");
    expect(() => encryptPersonalData("value")).toThrow("PERSONAL_DATA_ENCRYPTION_KEY must be a base64 encoded 32-byte key");

    setValidKeys();
    delete process.env.PERSONAL_DATA_HASH_KEY;
    expect(() => hashPersonalLookupValue("user@mail.ru")).toThrow("PERSONAL_DATA_HASH_KEY is not set");

    process.env.PERSONAL_DATA_HASH_KEY = Buffer.alloc(8, 1).toString("base64");
    expect(() => hashPersonalLookupValue("user@mail.ru")).toThrow("PERSONAL_DATA_HASH_KEY must be a base64 encoded 32-byte key");
  });

  it("throws when encrypted data format is invalid", () => {
    expect(() => decryptPersonalData("enc:v1:bad")).toThrow("Invalid encrypted personal data format");
  });

  it("encrypts and decrypts profile fields and user rows", () => {
    const profile = {
      first_name: "Иван",
      last_name: "Иванов",
      middle_name: "Иванович",
      phone: "+7",
      city: "Москва",
      avatar_url: "avatar.png",
      bio: "bio",
      social_vk: "vk.com/user",
      social_ok: "ok.ru/user",
      social_max: "max.ru/user",
      gender: "male",
    };

    const encryptedProfile = encryptProfilePersonalFields(profile);
    expect(encryptedProfile.gender).toBe("male");
    expect(encryptedProfile.first_name).toMatch(/^enc:v1:/);
    expect(decryptProfilePersonalFields(encryptedProfile)).toEqual(profile);
    expect(encryptProfilePersonalFields(null)).toBeNull();
    expect(decryptProfilePersonalFields(null)).toBeNull();

    const encryptedRow = {
      ...encryptedProfile,
      email: encryptEmail("USER@MAIL.RU"),
      role: "volunteer",
    };

    expect(decryptUserPersonalFields(encryptedRow).email).toBe("user@mail.ru");
    expect(decryptUserPersonalFields(null)).toBeNull();
    expect(decryptUserProfileRow(encryptedRow)).toEqual({
      ...profile,
      email: "user@mail.ru",
      role: "volunteer",
    });
    expect(decryptUserProfileRow(null)).toBeNull();
    expect(decryptUserProfileRows([encryptedRow])).toEqual([
      {
        ...profile,
        email: "user@mail.ru",
        role: "volunteer",
      },
    ]);
    expect(decryptUserProfileRows(null)).toEqual([]);
  });

  it("builds encrypted profile payload", () => {
    const payload = buildEncryptedProfilePayload({
      first_name: "Иван",
      last_name: "Иванов",
      middle_name: "",
      phone: "",
      city: "Москва",
      avatar_url: "avatar.png",
      bio: "bio",
      social_vk: "vk.com/user",
      social_ok: "ok.ru/user",
      social_max: "max.ru/user",
    });

    expect(payload.first_name).toMatch(/^enc:v1:/);
    expect(payload.middle_name).toBe("");
    expect(decryptProfilePersonalFields(payload).city).toBe("Москва");
  });

  it("sanitizes audit details recursively", () => {
    expect(sanitizeAuditDetails(null)).toBeNull();
    expect(sanitizeAuditDetails(undefined)).toBeUndefined();
    expect(sanitizeAuditDetails("plain")).toBe("plain");
    expect(
      sanitizeAuditDetails({
        email: "user@mail.ru",
        nested: {
          phone: "+7",
          visible: "ok",
        },
        list: [{ city: "Москва" }, "safe"],
      })
    ).toEqual({
      email: "[personal_data_hidden]",
      nested: {
        phone: "[personal_data_hidden]",
        visible: "ok",
      },
      list: [{ city: "[personal_data_hidden]" }, "safe"],
    });
  });
});
