# FlowMap

FlowMap uses Mapbox for place search and geocoding, then sends the resolved location to an OpenAI `gpt-5-mini` analysis endpoint that estimates traffic patterns and business suitability.

## Development

1. Install dependencies with `npm install`
2. Copy `.env.example` to `.env.local`
3. Set:
   - `VITE_MAPBOX_ACCESS_TOKEN`
   - `OPENAI_API_KEY`
   - optional tuning:
     - `ANALYSIS_CACHE_TTL_MS`
     - `RATE_LIMIT_WINDOW_MS`
     - `RATE_LIMIT_MAX_REQUESTS`
4. Start the app with `npm run dev`

## Validation

- `npm run build`
- `npm run lint`
- `npm run typecheck`

Saved locations are still stored in browser `localStorage`.

## Notes

- The Vite client proxies `/api` requests to the local Express server on port `8787` during development.
- Keep `OPENAI_API_KEY` server-side only. It is read by `server/index.js`.
- `/api/analyze` now applies in-memory caching and rate limiting.
- Current defaults:
  - cache TTL: 7 days
  - rate limit: 15 analysis requests per hour per client IP
- For production on multiple instances, move the cache and rate limit store to Redis or another shared backend.
