# Public landing page and application

The owner authorized replacement of the marketing homepage on October 1, 2026.

- `index.html` is the standalone public landing page. Styles and browser demo logic are in `public/workflow/`.
- `app.html` preserves the original application bootstrap and tracking configuration. Vite builds both HTML entries.
- Vercel serves `/` as the landing page; `/workflow` and `/workflow/` are aliases. Other frontend routes continue to use `app.html`. `/api/` is excluded as before.
- Vite development and preview map the existing `/app`, `/workspace`, `/dashboard`, `/saved`, and `/profile` routes to the application entry. The browser URL stays the requested application route.
- React navigation to `/` exits the application and loads the standalone homepage. Public navigation does not need authentication or backend credentials.

The homepage proposes one $250 Google Sheets inquiry-follow-up pilot. Pricing is an offer, not validated demand. The interactive sample uses fictional data, performs no network requests, and sends no customer messages. CSV export neutralizes formula-like input. Contact links open a draft addressed to `chatgpt@gettrafficscout.com`; the visitor must send it in their email client. No inquiry submission backend is connected.

Validation: `npm test`, `npm run build`, `npm run typecheck`, `npm run lint`. Check the homepage and an application URL in preview. `src/domain/__tests__/follow-up-queue.test.js` covers date rules, exceptions, source preservation, CSV parsing, row limits, and export safety.

Local validation on October 1, 2026: production build and typecheck pass. Run the test suite with `--maxWorkers=1` on this Windows host to avoid resource contention during simultaneous cold imports. The existing lint runner fails before inspecting source with `TypeError: expand is not a function`; its `brace-expansion >=5.0.8` override is incompatible with a minimatch consumer. Dependency remediation is outside this landing-page change. Browser verification confirms invalid-date review and the separate application sign-in route. The in-app browser download event did not resolve, so download completion is unverified there; CSV generation has automated coverage.
