# TrafficScout

TrafficScout uses Mapbox for place search and geocoding, then sends the resolved location to an OpenAI `gpt-5-mini` analysis endpoint that estimates traffic patterns and business suitability.

## Development

1. Install dependencies with `npm install`
2. Copy `.env.example` to `.env.local`
3. Set:
   - `VITE_MAPBOX_ACCESS_TOKEN`
   - `VITE_API_BASE_URL` (leave blank for local dev, set to your Render API URL in production)
   - `OPENAI_API_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_PRO_MONTHLY`
   - `STRIPE_PRICE_BUSINESS_MONTHLY`
   - `VITE_SITE_URL`
   - `ALLOWED_ORIGIN`
   - optional shared infrastructure:
     - `UPSTASH_REDIS_REST_URL`
     - `UPSTASH_REDIS_REST_TOKEN`
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
- In production, set `VITE_API_BASE_URL` to your deployed API origin and `ALLOWED_ORIGIN` to your frontend origin.
- Keep `OPENAI_API_KEY` server-side only. It is read by `server/index.js`.
- Phase 2 uses Supabase Auth/Postgres for users, subscriptions, usage, and saved locations.
- Stripe Checkout and Customer Portal are created from the server.
- `/api/analyze` now applies in-memory caching and rate limiting.
- If `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, caching and rate limiting switch to shared Upstash Redis storage automatically.
- Current defaults:
  - cache TTL: 7 days
  - rate limit: 15 analysis requests per hour per client IP
- Without Upstash Redis configured, the server falls back to local in-memory cache and rate limiting.
