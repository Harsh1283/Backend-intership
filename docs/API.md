# API Documentation

All public endpoints are exposed through the **API Gateway** on http://localhost:4000. The gateway is the only entry point — the User Service (:4001) and Notification Service (:4002) are internal and are **not** published to host ports. The routes below also exist at the service level, but clients should always go through the gateway.

All JSON request/response examples are shown with realistic values.

---

## Common error responses

| Status | Meaning | Example body |
|---|---|---|
| `400` | Validation failed | `{"success":false,"message":"Validation failed","errors":[{"field":"email","message":"A valid email is required"}]}` |
| `401` | Missing / invalid token (gateway) | `{"success":false,"message":"Unauthorized"}` |
| `401` | Invalid login credentials | `{"success":false,"message":"Invalid email or password"}` |
| `409` | Email already registered | `{"success":false,"message":"Email is already registered"}` |
| `429` | Rate limit exceeded (login) | express-rate-limit standard error body |
| `503` | Backend service unavailable | `{"success":false,"message":"Service temporarily unavailable"}` |
| `404` | Unknown route | `{"success":false,"message":"Route not found"}` |

---

## `POST /api/auth/signup`

Create a new user. On success, the User Service publishes a `user.created` event to RabbitMQ, which the Notification Service consumes asynchronously.

- **Auth required:** No
- **Request body:**

```json
{
  "name": "Test User",
  "email": "testuser@example.com",
  "password": "testpass123"
}
```

Validation: `name` required (non-empty string), `email` must be a valid email, `password` at least 8 characters.

- **Success — `201 Created`:**

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

- **`400 Bad Request`** — invalid input:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "password", "message": "Password must be at least 8 characters" }
  ]
}
```

- **`409 Conflict`** — email already exists:

```json
{ "success": false, "message": "Email is already registered" }
```

- **`503 Service Unavailable`** — user-service is down:

```json
{ "success": false, "message": "Service temporarily unavailable" }
```

---

## `POST /api/auth/login`

Exchange credentials for a JWT. Rate-limited (100 requests / 15 minutes).

- **Auth required:** No
- **Request body:**

```json
{
  "email": "testuser@example.com",
  "password": "testpass123"
}
```

- **Success — `200 OK`:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Use the token as `Authorization: Bearer <token>` on protected routes.

- **`401 Unauthorized`** — wrong credentials:

```json
{ "success": false, "message": "Invalid email or password" }
```

- **`400 Bad Request`** — validation (e.g., malformed email). See common errors above.
- **`503 Service Unavailable`** — user-service is down.

---

## `GET /api/auth/me`

Return the currently authenticated user.

- **Auth required:** Yes (`Authorization: Bearer <token>`)
- **Request headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

- **Success — `200 OK`:**

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

- **`401 Unauthorized`** — missing or invalid token:

```json
{ "success": false, "message": "Unauthorized" }
```

- **`503 Service Unavailable`** — user-service is down.

---

## `GET /api/notifications`

List notifications for the whole system (most recent 100, newest first). In this assignment the list is system-wide; each entry records a welcome email sent to a user after signup.

- **Auth required:** Yes (`Authorization: Bearer <token>`)
- **Request headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

- **Success — `200 OK`:**

```json
{
  "success": true,
  "notifications": [
    {
      "_id": "6aa2d27c9708809de174e18f",
      "userId": "6aa2d27cf78534046e84395a",
      "email": "testuser@example.com",
      "type": "welcome_email",
      "status": "sent",
      "createdAt": "2026-09-10T15:53:32.780Z"
    }
  ]
}
```

- **`401 Unauthorized`** — missing or invalid token.
- **`503 Service Unavailable`** — notification-service is down.

---

## `GET /health`

Gateway liveness probe.

- **Auth required:** No
- **Success — `200 OK`:**

```json
{ "status": "ok" }
```

---

## `GET /health/full`

Reports gateway status plus liveness of both backend services. Useful for the failure-handling checks in the README.

- **Auth required:** No
- **Success — `200 OK`** (all services up):

```json
{
  "gateway": "ok",
  "userService": "ok",
  "notificationService": "ok"
}
```

- **`503 Service Unavailable`** (at least one backend down):

```json
{
  "gateway": "ok",
  "userService": "ok",
  "notificationService": "unavailable"
}
```

---

See also [RabbitMQ.md](RabbitMQ.md) for the event topology, message format, and DLQ behavior.