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

The health endpoint `GET /api/health` returns:

```json
{"status":"ok"}
```

For the full development stack, including PostgreSQL, run `docker compose up --build` from the repository root. The Compose API service watches Java source changes and restarts the application.
