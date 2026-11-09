# Tasks

## 1. npm Workspace Setup

- [x] 1.1 Create root npm workspace scripts and `apps/api` / `apps/web` manifests with the required runtime and test dependencies; verify `npm install` succeeds and both workspaces are recognized.
- [x] 1.2 Add repository ignore rules for dependencies, build output, environment files, and the local SQLite database; verify generated runtime files are not tracked.

## 2. Persistence and Password Security

- [x] 2.1 Implement idempotent SQLite user and token-session schema plus safe user persistence; add tests for UUID/timestamp creation, normalized unique email, foreign keys, and password-hash exclusion from response objects.
- [x] 2.2 Implement per-user salted asynchronous scrypt hashing and constant-time verification, including dummy verification for unknown emails; add round-trip, wrong-password, salt uniqueness, and comparison tests.

## 3. Koa API

- [ ] 3.1 Implement `POST /register` and `POST /login` with request-size and field validation, consistent error envelopes, duplicate detection, safe user shapes, and opaque one-hour bearer tokens; add API tests for 201/200/400/401/409 and all specified edge cases.
- [ ] 3.2 Implement bearer authentication and `GET /me`; add tests for valid, missing, malformed, and expired tokens and verify secrets are absent from API output and logs.

## 4. Next.js User Experience

- [ ] 4.1 Implement registration/login views with matching real-time validation, form switching, disabled in-flight submission, loading feedback, and server error display; add tests for validation and request states.
- [ ] 4.2 Store the login token in `sessionStorage` with the required POC/security comment and implement the protected landing page using `/me`; add tests for successful navigation and missing/expired-token redirects.

## 5. Integration and Documentation

- [ ] 5.1 Wire Next.js same-origin rewrites and npm development/test/build scripts to the Koa API; verify both apps start together and registration-to-login-to-protected-page works end to end.
- [ ] 5.2 Update the README with npm setup, run/test commands, API routes, local database configuration, the POC token-storage caveat, and the production rate-limiting note; verify every documented command matches the package scripts.
