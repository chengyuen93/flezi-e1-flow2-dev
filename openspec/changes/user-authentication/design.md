# Design

## Context

The repository is a greenfield project with no existing application code or package manifests. The API response shapes, validation rules, and frontend behaviors are defined in the accompanying `user-auth` spec.

## Goals / Non-Goals

**Goals:**
- Keep the API and frontend independently runnable through npm workspaces.
- Make registration, login, and protected-user lookup testable without a running web server.
- Keep plaintext passwords and bearer tokens out of persistent storage and logs.

**Non-Goals:**
- Email verification, password recovery, third-party identity providers, and production-grade distributed session infrastructure.
- Implementing rate limiting in this POC; document a production rate-limiting design instead.

## Decisions

1. **Use an npm workspace with `apps/api` and `apps/web`.** The API is Node.js/Koa and the frontend is Next.js with TypeScript. The Next.js server rewrites same-origin `/register`, `/login`, and `/me` requests to the configurable Koa API origin, avoiding browser CORS configuration. Root scripts coordinate development, tests, and builds.

2. **Use SQLite with `better-sqlite3`.** Create a `users` table with a UUID primary key, normalized email protected by a unique index, password hash, and ISO-8601 creation timestamp. Store bearer sessions separately using a SHA-256 token hash as the lookup key, a user foreign key, and an expiry timestamp. The raw bearer token is returned only at login and is never persisted.

3. **Use Node.js `crypto.scrypt` for password hashes.** Generate a cryptographically random per-user salt and store the algorithm parameters, salt, and derived key in an explicit encoded format. Verify with `timingSafeEqual` after checking equal buffer lengths. For an unknown email, perform a dummy scrypt verification before returning the same generic 401 response to reduce timing-based account discovery.

4. **Issue opaque, server-validated bearer tokens.** Generate 32 random bytes, encode them as base64url, and return `{ token, expiresIn: 3600, user }`. Persist only the token's SHA-256 hash and its one-hour expiry. `GET /me` validates the `Authorization: Bearer` value against an unexpired session and returns only the safe user fields.

5. **Keep the POC token in `sessionStorage` as explicitly required.** The frontend stores it per tab and sends it in the Authorization header for protected requests. Add a concise code comment at the storage call explaining that this is a POC-specific requirement, that JavaScript can access the token, and that production should prefer an HttpOnly, Secure, SameSite cookie. This is a deliberate trade-off and not a claim that `sessionStorage` is XSS-proof.

6. **Validate at both boundaries.** Use Zod in the API to normalize email and enforce email length (254 characters), password length (8-128 characters), and letter/number rules before database work. Return a consistent JSON error envelope with a message and optional per-field errors. Apply equivalent client-side checks for immediate feedback; server validation remains authoritative.

7. **Protect the landing page through the API.** The dashboard checks for a session token on the client, calls `/me`, and renders protected content only after successful validation. Missing or expired sessions return the visitor to the registration/login view. The login form stores the token before navigating to the dashboard.

8. **Document rate limiting as production hardening.** Before public deployment, add an API gateway or persistent limiter keyed by client IP and normalized account identifier, with bounded retries and a generic response that does not reveal account existence. The POC does not lock accounts or implement an in-memory limiter.

9. **Separate HTTP controllers from authentication services.** `controllers/authController.ts` owns request validation, status codes, and response shapes. `services/authService.ts` owns registration, credential verification, token issuance, and user lookup without depending on Koa. `app.ts` only configures middleware and routes, keeping service behavior independently testable.

## Risks / Trade-offs

- **`sessionStorage` exposes the bearer token to same-origin JavaScript.** The requested POC behavior is documented in code; production should move to a server-managed HttpOnly, Secure, SameSite cookie and address CSRF accordingly.
- **A local SQLite file is single-instance storage.** This is appropriate for the POC but requires a shared database/session store before horizontally scaling the API.
- **Scrypt consumes CPU by design.** Use the asynchronous crypto API and a reviewed work factor so login hashing does not block Koa's event loop.
- **Rate limiting is not enforced in the POC.** Add the documented limiter before exposing the service publicly.

## Migration Plan

There is no existing application data to migrate. Create the SQLite schema idempotently at API startup; keep the local database file out of version control.
