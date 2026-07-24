// @ts-check
/**
 * Centralized error reporting and Express error-handling middleware.
 */

import * as Sentry from "@sentry/node";

const sentryDsn = process.env.SENTRY_DSN;

/**
 * Report a server error to console and Sentry (if configured).
 * @param {unknown} error
 * @param {Record<string, unknown>} [context]
 */
export function reportServerError(error, context = {}) {
  console.error(error);

  if (!sentryDsn) return;

  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      scope.setContext(key, value);
    });
    Sentry.captureException(error);
  });
}

/**
 * Express error-handling middleware (4-arg signature).
 */
export function errorHandler(error, req, res, _next) {
  reportServerError(error, {
    route: { path: req.path, method: req.method },
  });

  if (res.headersSent) return;

  if (req.path.startsWith("/api/")) {
    res.status(500).json({ error: error?.message || "Internal Server Error" });
    return;
  }

  res.status(500).send(error?.message || "Internal Server Error");
}
