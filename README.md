# Backend Internship Assignment — Event-Driven Microservices

A small event-driven microservices system: an API Gateway, a User Service, and a Notification Service built on Node.js/Express, MongoDB, and RabbitMQ, all runnable with a single `docker compose up` command. The gateway is the only HTTP entry point; the User Service and Notification Service never talk to each other directly — they communicate asynchronously through RabbitMQ events.

---

## Architecture

![Architecture diagram](docs/architecture-diagram.svg)

The system is split into two communication styles:

- **Synchronous (HTTP)** — The API Gateway accepts HTTP requests from the client and proxies them to the backend services. The client never reaches the User Service or Notification Service directly.
- **Asynchronous (RabbitMQ)** — The User Service and Notification Service communicate **only** via RabbitMQ. When a user signs up, the User Service publishes a `user.created` event to the `user_events` exchange. The Notification Service consumes that event and creates a welcome notification. This satisfies the assignment's core requirement: *backend services are decoupled by events, not direct HTTP calls*.

Request flow: `Client → API Gateway → User Service` (signup) → event published to RabbitMQ → `Notification Service` consumes the event asynchronously → notification persisted to MongoDB.

## Tech Stack

- **Node.js / Express** — all three services
- **MongoDB** — persistence (separate database per service)
- **RabbitMQ** — event bus with a dead-letter queue
- **JWT** — stateless authentication
- **Docker / Docker Compose** — containerized, single-command orchestration

## Prerequisites

- Docker & Docker Compose installed (Docker Desktop on Windows/macOS, or Docker Engine + Compose plugin on Linux)
- Git
- (Optional) Postman or cURL for testing

## Setup & Run Instructions

```bash
git clone <repo-url>
cd Backend-intership
cp user-service/.env.example user-service/.env
cp notification-service/.env.example notification-service/.env
cp api-gateway/.env.example api-gateway/.env
cp .env.example .env
# fill in real values in each .env (see "Environment Variables Reference" below)
docker compose up --build -d
docker compose ps   # confirm all 5 containers are Up
```

All 5 containers — `mongodb`, `rabbitmq`, `user-service`, `notification-service`, `api-gateway` — should show **Up** (MongoDB and RabbitMQ should also show **healthy**).

| Service | Address |
|---|---|
| API Gateway | http://localhost:4000 |
| RabbitMQ Management UI | http://localhost:15672 |

## How to Verify It's Working

### 1. Sign up a user — expect `201`

```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"testuser@example.com","password":"testpass123"}'
```

Expected:

```json
{
  "success": true,
  "user": {
    "id": "6aa2d27cf78534046e84395a",
    "name": "Test User",
    "email": "testuser@example.com",
    "createdAt": "2026-09-10T15:53:32.759Z"
  }
}
```

### 2. Sign up with the same email again — expect `409`

```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"testuser@example.com","password":"testpass123"}'
```

Expected: `409 Conflict` — `{"success": false, "message": "Email is already registered"}`

### 3. Log in — expect `200` and a JWT token

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"testpass123"}'
```

Expected:

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Copy the token — you'll use it below.

### 4. Get the current user with the JWT — expect `200`

```bash
curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected: `200 OK` with the user object from step 1.

### 5. Call `/me` without a token — expect `401`

```bash
curl http://localhost:4000/api/auth/me
```

Expected: `401 Unauthorized` — `{"success": false, "message": "Unauthorized"}`

### 6. List notifications — expect `200` and the welcome notification

```bash
curl http://localhost:4000/api/notifications \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected:

```json
{
  "success": true,
  "notifications": [
    {
      "_id": "...",
      "userId": "6aa2d27cf78534046e84395a",
      "email": "testuser@example.com",
      "type": "welcome_email",
      "status": "sent",
      "createdAt": "2026-09-10T15:53:32.780Z"
    }
  ]
}
```

The welcome notification proves the full async chain worked: signup → `user.created` event on RabbitMQ → consumer → MongoDB.

### 7. (Optional) Failure handling

```bash
docker compose stop user-service
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"X","email":"x@example.com","password":"testpass123"}'
# → 503 {"success":false,"message":"Service temporarily unavailable"}
docker compose start user-service
```

## Environment Variables Reference

| File | Variable | Purpose | Example value |
|---|---|---|---|
| `.env` (root) | `MONGO_ROOT_USERNAME` | MongoDB admin username (container init) | `admin` |
| `.env` (root) | `MONGO_ROOT_PASSWORD` | MongoDB admin password (container init) | `Ch4ngeMe!` |
| `.env` (root) | `RABBITMQ_DEFAULT_USER` | RabbitMQ default username (container init) | `admin` |
| `.env` (root) | `RABBITMQ_DEFAULT_PASS` | RabbitMQ default password (container init) | `Ch4ngeMe!` |
| `.env` (root) | `MONGO_URI` | Informational; Mongo URI for the running stack | `mongodb://admin:pass@localhost:27017` |
| `.env` (root) | `RABBITMQ_URL` | Informational; AMQP URI for the running stack | `amqp://admin:pass@localhost:5672` |
| `api-gateway/.env` | `PORT` | Gateway HTTP port | `4000` |
| `api-gateway/.env` | `USER_SERVICE_URL` | Internal URL of the user-service container | `http://user-service:4001` |
| `api-gateway/.env` | `NOTIFICATION_SERVICE_URL` | Internal URL of the notification-service container | `http://notification-service:4002` |
| `api-gateway/.env` | `JWT_SECRET` | Secret used to verify JWT tokens (must match user-service) | `a-long-random-string` |
| `user-service/.env` | `PORT` | User-service internal port | `4001` |
| `user-service/.env` | `MONGO_URI` | Mongo connection string for the user DB | `mongodb://admin:pass@mongodb:27017/user_service?authSource=admin` |
| `user-service/.env` | `RABBITMQ_URL` | AMQP connection string | `amqp://admin:pass@rabbitmq:5672` |
| `user-service/.env` | `JWT_SECRET` | Secret used to sign JWT tokens (must match gateway) | `a-long-random-string` |
| `user-service/.env` | `JWT_EXPIRES_IN` | Token lifetime | `1h` |
| `notification-service/.env` | `PORT` | Notification-service internal port | `4002` |
| `notification-service/.env` | `MONGO_URI` | Mongo connection string for the notifications DB | `mongodb://admin:pass@mongodb:27017/notification_service?authSource=admin` |
| `notification-service/.env` | `RABBITMQ_URL` | AMQP connection string | `amqp://admin:pass@rabbitmq:5672` |

> Note: passwords in the three service `.env` files must match `MONGO_ROOT_PASSWORD` / `RABBITMQ_DEFAULT_PASS` in the root `.env`. Use different values than shown here (these are examples, not real secrets).

## Known Issues Found & Fixed During Testing

1. **Credential mismatch between containers and services.** MongoDB and RabbitMQ containers are initialized with passwords from the root `.env` (`MONGO_ROOT_PASSWORD` / `RABBITMQ_DEFAULT_PASS`), but all three service `.env` files initially pointed at a different password. Services failed to authenticate on first boot.
   **Fix:** updated `user-service/.env`, `notification-service/.env`, and root `.env` so connection strings use the same credentials the containers are initialized with.

2. **Flaky `503` when a backend was stopped.** When `user-service` is stopped, its Docker DNS name stops resolving, producing `EAI_AGAIN` roughly 5 seconds later. The gateway also set a 5s idle `timeout` on the *incoming* request socket; whichever event fired first won the race — sometimes the connection was destroyed with no response at all instead of a clean `503`.
   **Fix:** in both `api-gateway/src/routes/userProxy.js` and `notificationProxy.js`, removed the destructive incoming-socket `timeout` and added a `!res.destroyed` guard in the proxy error handler. The gateway now returns a deterministic `503 Service temporarily unavailable` every time (verified 5/5 attempts).

3. **Notification-service startup race with RabbitMQ.** The consumer lacked a connection retry loop (the user-service had one), so on the very first boot the notification-service crashed and restarted a few times while RabbitMQ was finishing startup.
   **Fix:** added a 10-attempt / 3s-backoff retry loop in `notification-service/src/consumers/userEventsConsumer.js`, matching the user-service pattern. It now connects cleanly on the first start.

## Security Notes

Implemented:

- Passwords hashed with **bcrypt** (cost factor 12) — plaintext is never stored.
- **JWT-based auth** — tokens signed with a shared secret; both the gateway and user-service verify them.
- **Rate limiting** on the login endpoint (100 requests / 15 min).
- **Helmet** security headers on the gateway.
- **Credentials via environment variables** (`env_file` in Compose) — never hardcoded, and `.env` files are gitignored.

Not production-hardened yet (known limitations):

- RabbitMQ and MongoDB expose unencrypted TCP ports on localhost (no TLS in front of the broker).
- No secret manager / rotation — secrets live in `.env` files.
- CORS is wide open (development default) — restrict `cors()` origins before a real deployment.
- `JWT_SECRET` example values must be replaced with strong random secrets.

## Future Improvements

- Send real emails via an SMTP provider instead of the simulated welcome email.
- Message idempotency on the consumer (dedupe `user.created` events by event/correlation ID).
- Correlation IDs for end-to-end request tracing across services.
- CI pipeline (lint, test, build, deploy).
- Container resource limits and healthchecks with Docker Compose.
- OpenAPI (Swagger) spec generation from the API docs.