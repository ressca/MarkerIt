# MarkerIt API

A minimal Spring Boot REST API for MarkerIt.

## Requirements

- JDK 21 or newer
- Gradle 8.14 or newer (or Gradle 9)

## Run locally

From `apps/api`:

```sh
gradle bootRun
```

The API connects to PostgreSQL using `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, and `SPRING_DATASOURCE_PASSWORD`. Flyway applies versioned SQL migrations from `src/main/resources/db/migration` at startup. The first migration creates the user table with normalized unique email addresses and password hash storage.

Authentication uses Spring Security Resource Server with Nimbus-signed HS256 JWTs in an HttpOnly `markerit_session` cookie. PostgreSQL stores active session identifiers so logout can revoke tokens. Set `JWT_SECRET` to a random value of at least 32 UTF-8 bytes in deployed environments, and set `AUTH_COOKIE_SECURE=true` behind HTTPS. Browser origins are configured with `CORS_ALLOWED_ORIGINS`. API problem responses and field validation messages are in English.

The health endpoint `GET /api/health` returns:

```json
{"status":"ok"}
```

For the full development stack, including PostgreSQL, run `docker compose up --build` from the repository root. The Compose API service watches Java source changes and restarts the application.
