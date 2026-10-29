# Frontend configuration

Use Node.js 20.x, 22.x, or 24+ to run the automated test suite.

Copy `.env.example` to `.env` for local development and set:

- `VITE_API_URL` to the backend API base, including `/api` (the local backend default is `http://localhost:8080/api`).
- `VITE_GOOGLE_CLIENT_ID` to the Google OAuth **Web client ID**. This is a public client identifier; do not put a client secret in Vite variables.

Set the same two build variables in the Cloudflare Workers project's build environment. Point `VITE_API_URL` at the deployed backend API base. Vite embeds `VITE_*` values at build time, so set them before the production build. The backend must allow the deployed frontend origin in CORS and use the matching Google Web client ID.

## Real Google Sign-In check

1. Set `VITE_GOOGLE_CLIENT_ID` locally and configure the same Web client ID on the backend. Add `http://localhost:5173` and `https://retail-app-fe.bhargavvishwa2002.workers.dev` to the Google OAuth client's authorized JavaScript origins.
2. Start the backend and frontend, then open `http://localhost:5173/login`.
3. Sign in with the bootstrapped Owner's verified Google email. A receptionist must first be pre-registered by an Owner with the exact verified email.
4. Confirm the frontend exchanges Google's ID token at `POST /api/auth/google`, then loads the workspace using the returned application token. Confirm the `retail-token` and expiry session entries contain the application token, and that the Google ID token is not stored.
5. Refresh the page to exercise `GET /api/auth/me`; then sign out and confirm `POST /api/auth/logout` is sent and the session values are cleared.
6. Repeat with a receptionist account. Confirm the operational dashboard loads and direct visits to Owner-only routes show access denied.
