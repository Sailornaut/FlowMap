# FlowMap

FlowMap uses Mapbox for place search and geocoding, then sends the resolved location to an OpenAI `gpt-5-mini` analysis endpoint that estimates traffic patterns and business suitability.

## Development

1. Install dependencies with `npm install`
2. Copy `.env.example` to `.env.local`
3. Set:
   - `VITE_MAPBOX_ACCESS_TOKEN`
   - `OPENAI_API_KEY`
4. Start the app with `npm run dev`

## Validation

- `npm run build`
- `npm run lint`
- `npm run typecheck`

Saved locations are still stored in browser `localStorage`.

## Notes

- The Vite client proxies `/api` requests to the local Express server on port `8787` during development.
- Keep `OPENAI_API_KEY` server-side only. It is read by `server/index.js`.
