# MarkerIt API

Minimalna aplikacja REST Spring Boot dla backendu MarkerIt.

## Wymagania

- JDK 21 lub nowszy
- Gradle 8.14 lub nowszy (albo Gradle 9)

## Uruchomienie

Z katalogu `apps/api`:

```sh
gradle bootRun
```

Kontrolny endpoint `GET /api/health` zwraca:

```json
{"status":"ok"}
```
