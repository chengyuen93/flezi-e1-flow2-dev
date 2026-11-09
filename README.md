# flezi-e1-flow2-dev

## User Story Effort Estimate

**Story:** As a new visitor, I want to register an account and log in securely, so that I can access personalized features of the application.

| Factor | Your Assessment |
|---|---|
| Complexity (how hard is the logic?) | High: validate email format and password rules, enforce email uniqueness, hash passwords with a salted password-hashing algorithm, return safe user data, and issue authentication state with an expiry. Wrong-credential responses must remain generic to reduce user-enumeration risk. |
| Effort (how much work / how many parts?) | Multiple integrated parts across the Next.js frontend, Node.js/Koa API, and SQLite: registration and login flows, field-level validation, persistence, token/session expiry, defined HTTP responses (201, 400, 401, and 409), and tests for success and failure cases. |
| Uncertainty / Risk (unknowns, dependencies?) | The acceptance criteria clarify validation and response behavior. Some implementation choices remain open, particularly JWT vs. opaque token vs. session, expiry duration, and the exact salted hashing algorithm. Security-sensitive credential storage and authentication behavior need careful implementation and verification. |
| Your Estimate (points) | **8 points (Fibonacci scale)** |
| Rationale (explain how you arrived at your estimate) | Estimated at 8 rather than 5 because this is an end-to-end, multi-layer feature with security-sensitive password storage and authentication state, plus explicit validation rules, safe response requirements, expiry, and distinct negative-path HTTP contracts. The estimate includes implementing and verifying these behaviors across the frontend and backend with SQLite. |

## Local Development

### Requirements

- Node.js 22.12.0 or newer
- npm

### Install and run

From the repository root:

```sh
npm install
npm run dev
```

The root development script starts both applications: the Next.js frontend at
`http://localhost:3000` and the Koa API at `http://localhost:4000`. Next.js rewrites
same-origin `/register`, `/login`, and `/me` requests to the API, avoiding browser CORS
configuration.

Set `API_URL` when the API is listening at a different origin; its default is
`http://localhost:4000`. For example:

```sh
API_URL=http://localhost:4001 npm run dev
```

Run the workspace tests and production builds from the root:

```sh
npm run test
npm run build
```

`npm run test` runs the API and frontend suites. `npm run build` builds both workspaces.
The API and frontend can also be run separately with
`npm run dev --workspace=@flezi/api` and `npm run dev --workspace=@flezi/web`.

### API routes

| Method and path | Success response | Errors |
|---|---|---|
| `POST /register` | `201` with `id`, normalized `email`, and `createdAt` | `400` validation errors; `409` if the email is already registered |
| `POST /login` | `200` with an opaque `token`, `expiresIn` in seconds, and safe `user` fields | `400` validation errors; `401` with a generic invalid-credentials message |
| `GET /me` | `200` with the safe authenticated user | `401` when the bearer token is missing, invalid, or expired |

Registration and login accept JSON bodies containing `email` and `password`. Protected
requests send the login token as `Authorization: Bearer <token>`.

### Local database

The API creates its SQLite database on startup. By default, `DATABASE_PATH` is
`data/auth.sqlite` relative to the API workspace (normally `apps/api/data/auth.sqlite`
when launched with the workspace scripts). Override it with an absolute or API-workspace
relative path:

```sh
DATABASE_PATH=/absolute/path/to/auth.sqlite npm run dev
```

SQLite database files are ignored by Git.

### Security notes

- Passwords are stored as per-user salted scrypt hashes. Login sessions store only a hash
  of the bearer token and expire after one hour. The API does not return password hashes.
- This POC stores the login token in browser `sessionStorage` as required. It is readable
  by same-origin JavaScript and is not an XSS defense; production should use an
  `HttpOnly`, `Secure`, `SameSite` cookie and address CSRF protections.
- Never deploy without HTTPS. Do not log passwords, bearer tokens, or password hashes.
- Rate limiting is not implemented in this POC. Before public deployment, add an API
  gateway or persistent limiter keyed by client IP and normalized account identifier,
  with bounded retries and generic responses that do not disclose whether an account
  exists.