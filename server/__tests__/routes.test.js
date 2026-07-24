import { describe, expect, it } from "vitest";

/**
 * Route module import tests.
 *
 * These verify that the new route modules and middleware can be loaded
 * without errors and export the expected shapes. Full integration tests
 * require a running Supabase instance and are documented as
 * "requires live-service verification" in the audit.
 */

describe("route modules load without errors", () => {
  it("properties router exports a function", async () => {
    const mod = await import("../routes/properties.js");
    expect(typeof mod.default).toBe("function");
  });

  it("tenants router exports a function", async () => {
    const mod = await import("../routes/tenants.js");
    expect(typeof mod.default).toBe("function");
  });

  it("vacancies router exports a function", async () => {
    const mod = await import("../routes/vacancies.js");
    expect(typeof mod.default).toBe("function");
  });

  it("analyses router exports a function", async () => {
    const mod = await import("../routes/analyses.js");
    expect(typeof mod.default).toBe("function");
  });
});

describe("middleware modules load without errors", () => {
  it("auth middleware exports populateAuth, requireAuth, requireStaff", async () => {
    const mod = await import("../middleware/auth.js");
    expect(typeof mod.populateAuth).toBe("function");
    expect(typeof mod.requireAuth).toBe("function");
    expect(typeof mod.requireStaff).toBe("function");
  });

  it("error-handler exports reportServerError and errorHandler", async () => {
    const mod = await import("../middleware/error-handler.js");
    expect(typeof mod.reportServerError).toBe("function");
    expect(typeof mod.errorHandler).toBe("function");
  });
});

describe("service modules load without errors", () => {
  it("supabase-admin exports getSupabaseAdmin", async () => {
    const mod = await import("../services/supabase-admin.js");
    expect(typeof mod.getSupabaseAdmin).toBe("function");
  });
});

describe("requireAuth middleware rejects unauthenticated requests", () => {
  it("returns 401 when authContext is null", async () => {
    const { requireAuth } = await import("../middleware/auth.js");
    const req = { authContext: null };
    const res = {
      _status: null,
      _body: null,
      status(code) { this._status = code; return this; },
      json(body) { this._body = body; },
    };
    const next = () => { throw new Error("should not call next"); };

    requireAuth(req, res, next);
    expect(res._status).toBe(401);
    expect(res._body.error).toContain("Sign in");
  });
});

describe("requireStaff middleware rejects non-staff", () => {
  it("returns 403 when profile has no role", async () => {
    const { requireStaff } = await import("../middleware/auth.js");
    const req = { authContext: { profile: { role: null } } };
    const res = {
      _status: null,
      _body: null,
      status(code) { this._status = code; return this; },
      json(body) { this._body = body; },
    };
    const next = () => { throw new Error("should not call next"); };

    requireStaff(req, res, next);
    expect(res._status).toBe(403);
    expect(res._body.code).toBe("internal_access_required");
  });

  it("calls next when profile has staff role", async () => {
    const { requireStaff } = await import("../middleware/auth.js");
    const req = { authContext: { profile: { role: "analyst" } } };
    let called = false;
    const next = () => { called = true; };

    requireStaff(req, {}, next);
    expect(called).toBe(true);
  });
});
