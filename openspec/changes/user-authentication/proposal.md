# Proposal

## Why

Visitors currently have no way to create an account or authenticate. This change adds the secure registration and login slice needed to establish authenticated access for future personalized features.

## What Changes

- Add registration and login forms in the Next.js frontend and corresponding Node.js/Koa API endpoints backed by SQLite.
- Normalize email addresses by trimming and lowercasing; enforce uniqueness, email format, and passwords of 8-128 characters containing a letter and a number. Reject oversized email input above 254 characters.
- Store passwords only as per-user salted scrypt hashes. Return the defined safe registration user (201), field-level validation errors (400), duplicate-email error (409), and generic bad-credentials error (401).
- Issue a random opaque bearer token on successful login, return it with `expiresIn: 3600` and a safe user, and persist only its hash with its expiry.
- Provide real-time form validation, in-flight submit feedback, view switching, and a protected landing page. Store the bearer token in `sessionStorage` as required for this POC; it is JavaScript-accessible and therefore more exposed to XSS than an HttpOnly cookie. The implementation will include a concise comment noting this POC-specific tradeoff and the safer production alternative.
- Add automated coverage for validation, registration, login, token expiry, safe responses, and authentication failure cases. Document rate limiting as a production hardening follow-up.

## Capabilities

### New Capabilities

- `user-auth`: Account registration, credential validation, bearer-token issuance, and protected access.

### Modified Capabilities

None.

## Impact

- Adds npm workspace packages for the Next.js frontend and Koa API, plus SQLite user/token persistence and authentication tests.
- Adds registration and login UI, Koa `POST /register` and `POST /login` endpoints, and a protected landing page backed by authenticated user lookup.
- Updates the README with local setup and run instructions.
