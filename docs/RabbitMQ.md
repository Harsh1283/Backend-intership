# RabbitMQ — Event Topology & Message Format

RabbitMQ is the asynchronous backbone of the system. The **User Service never calls the Notification Service over HTTP**; it only publishes events, and the Notification Service only consumes events. This decoupling is the assignment's core requirement.

Management UI: http://localhost:15672 (credentials from `RABBITMQ_DEFAULT_USER` / `RABBITMQ_DEFAULT_PASS` in the root `.env`).

---

## Topology

| Object | Name | Type | Notes |
|---|---|---|---|
| Exchange | `user_events` | direct, durable | All user domain events are published here |
| Exchange | `user_events_dlx` | direct, durable | Dead-letter exchange |
| Queue | `user_events` | durable | Live queue; bound to `user_events` with routing key `user.created`; declared with `x-dead-letter-exchange: user_events_dlx` |
| Queue | `user_events_dlq` | durable | Dead-letter queue; bound to `user_events_dlx` with routing key `user.created` |

When the User Service starts it declares the exchange, exchange-DLX, queue, and binding. The Notification Service declares the same topology (redeclaration with identical properties is a no-op) plus the DLQ.

Current supported routing key: **`user.created`**

## Message format

To satisfy the consumer's validation, the exact JSON shape is:

```json
{
  "userId": "6aa2d27cf78534046e84395a",
  "name": "Test User",
  "email": "testuser@example.com"
}
```

Published by the User Service with:

- `contentType: application/json`
- `persistent: true`
- `type: user.created`
- routing key: `user.created` on exchange `user_events`

The consumer rejects a message if `userId`, `name`, or `email` is missing, not a string, or empty.

## ACK / NACK and dead-letter routing

The Notification Service consumes one message at a time (`prefetch(1)`) and acknowledges each message **manually**. If the message is parsed and validated successfully, a welcome notification is written to Mongo and the consumer calls `channel.ack(msg)`. If anything fails — malformed JSON, missing/invalid fields, or a database error — the consumer calls `channel.nack(msg, false, false)` (no requeue), which tells RabbitMQ to dead-letter the message to the `user_events_dlq` via the `user_events_dlx` exchange. Rejected messages therefore never poison the live queue or re-enter the consumer loop, and the service keeps running.

## Failure-handling test (malformed message)

Publish an invalid payload to the live exchange and confirm it lands in the DLQ without crashing the consumer:

```bash
curl -u admin:PASSWORD -H "Content-Type: application/json" \
  -d '{"properties":{},"routing_key":"user.created","payload":"{this-is-not-valid-json-","payload_encoding":"string"}' \
  http://localhost:15672/api/exchanges/%2F/user_events/publish
```

Expected: response `{"routed":true}`, the consumer logs `Failed to process user event; routing to DLQ`, and the `user_events_dlq` queue message count increments while the Notification Service container keeps running.