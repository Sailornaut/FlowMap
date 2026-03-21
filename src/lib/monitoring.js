import * as Sentry from "@sentry/react";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

export function initMonitoring() {
  if (!sentryDsn) {
    return;
  }

  const traceTargets = [window.location.origin];
  if (apiBaseUrl) {
    traceTargets.push(apiBaseUrl);
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1),
    tracePropagationTargets: traceTargets,
  });
}
