import { describe, expect, it } from "vitest";
import { hasInternalAccess, isAdmin } from "../access-control.js";

describe("hasInternalAccess", () => {
  it("grants access to admins and analysts", () => {
    expect(hasInternalAccess({ role: "admin" })).toBe(true);
    expect(hasInternalAccess({ role: "analyst" })).toBe(true);
  });

  it("denies access when role is null or missing — a session alone is not enough", () => {
    expect(hasInternalAccess({ role: null })).toBe(false);
    expect(hasInternalAccess({})).toBe(false);
    expect(hasInternalAccess(null)).toBe(false);
    expect(hasInternalAccess(undefined)).toBe(false);
  });

  it("denies unknown roles (defense against bad data)", () => {
    expect(hasInternalAccess({ role: "customer" })).toBe(false);
    expect(hasInternalAccess({ role: "ADMIN" })).toBe(false);
  });
});

describe("isAdmin", () => {
  it("is true only for the admin role", () => {
    expect(isAdmin({ role: "admin" })).toBe(true);
    expect(isAdmin({ role: "analyst" })).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});
