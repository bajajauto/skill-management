# Skills Platform

```
client/   React + TypeScript + Vite app. TD Admin is one page (#/admin/...) inside the app shell.
server/   Express API. Persists the TD setup to server/data/setup.json (git-ignored).
scripts/  dev.mjs runs both together.
```

## Run

```
npm run install:all
npm run dev          # client http://localhost:5173, API http://localhost:3001
```

The client proxies `/api` to the server, so there is no CORS setup.

## API

| Method | Path         | Purpose                                              |
| ------ | ------------ | ---------------------------------------------------- |
| GET    | /api/health  | Liveness check                                       |
| GET    | /api/setup   | Stored TD setup, or 204 if nothing saved yet         |
| PUT    | /api/setup   | Replace the TD setup (validated, written atomically) |
