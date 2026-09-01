# Callback Assistant

Automated call-back system: a website visitor requests a call-back through a form, the
backend stores and validates the request, then a call worker initiates an AI-driven phone
call, processes the results and executes configurable follow-up actions.

## Overview

| | |
|---|---|
| **Purpose** | Let website visitors request a call-back; an AI agent calls them back, holds a conversation, and triggers follow-up actions |
| **Status** | Design / planning phase |
| **Planned stack** | Self-hosted backend + **VAPI** (managed voice-AI provider) for telephony and AI conversation |
| **Core principle** | External services are **executors**, the backend is the **decision maker** — all meaningful data is written back into our own database via webhooks |

## Architecture Decisions

| Area | Choice | Rationale |
|---|---|---|
| Call handling + AI (STT/TTS/LLM) | **VAPI** (managed voice-AI provider) | Fastest time-to-market; one provider covers telephony and the whole AI conversation chain |
| Everything else | **Self-hosted backend** | Data, state and business logic stay under our control |
| Provider coupling | **`CallProvider` interface** | VAPI is wrapped behind an adapter, so it can be swapped (Vocode, Retell, BYO) without touching core logic |

## Components

| Component | Responsibility |
|---|---|
| Web Frontend | Call-back request form (name, email, reason) |
| Request API | Receive + validate the submission (email, phone, reason sanity) |
| Database | `callback_requests`, `call_details`, plus audit tables (`call_events`, `actions`, `notifications`, `bookings`) |
| Call Queue + Action Queue | Two separate queues: call jobs (initiate calls) and action jobs (run actions) |
| Call Dispatcher | Consumes the call queue: loads a request and starts the call via the CallProvider |
| VAPI (Call Provider) | Outbound call + real-time STT/TTS/LLM conversation; emits webhook events, transcript and summary |
| Webhook Receiver | Receives provider events (status, transcript, summary); updates status; saves call details |
| Action Executor | Runs actions — in-call (tool-calls, synchronous) and post-call (via the action queue) |
| Action Registry | Extensible registry of actions (notify, calendar, ...) |
| Notification Service | Email / SMS / push to owner and caller |
| Calendar Service | Booking proposals (e.g., Google Calendar / Microsoft Graph) |
| Admin Dashboard | Owner-facing view of requests, calls, recordings and stats |

## Core Flow

1. A visitor fills the call-back form (name, email, reason).
2. The backend validates the input; invalid data returns a `422` error.
3. Valid requests are stored (`status: queued`), a call job is enqueued, and the visitor gets a `202 Accepted` response.
4. The **Call Dispatcher** picks up the job and starts the call via VAPI.
5. VAPI dials the caller and runs the STT/TTS/LLM conversation; it emits webhook events (status, transcript, summary, tool-calls).
6. The **Webhook Receiver** updates the request status, stores the call details, and enqueues action jobs.
7. In-call tool-calls are executed synchronously by the **Action Executor** (e.g., instant calendar confirmation).
8. Post-call actions run asynchronously through the action queue (notifications, booking proposals, follow-ups).

> Full sequence diagram: [`docs/01-callback-assistant.md`](docs/01-callback-assistant.md)

## Call Lifecycle State Machine

```
queued → dialing → ringing → in-progress → completed | failed | no_answer | busy
                                                              ↘
                                                    actions-executing → done
```

- `failed` covers dial errors, AI / telephony errors and line-busy timeouts.
- A request always reaches a terminal state (`done`, `fail`, `no_answer`, `busy`); a failed step never leaves a request hanging in an intermediate state.

## Error Handling Strategy

- Every step is logged with a **correlation id** so a single request can be traced end-to-end.
- Failures during call handling mark the request as `fail` and notify the owner.
- Partial action failures are logged and retried with **exponential backoff**; permanently failed calls land in a dead-letter review queue.
- In-call tool-calls must be answered promptly (the provider waits); on failure, return an error result so the assistant can recover gracefully.

## Extensible Action Engine

Actions are registered behind a uniform interface so the list can grow without changing the core flow:

```
interface Action {
    name: string
    execute(context: CallContext): ActionResult
}
```

Planned actions:

- Notify owner (email / SMS / push)
- Notify caller (what happened, next steps)
- Calendar booking proposal (awaiting acceptance)
- CRM update, ticket creation, follow-up reminders (future)

## Documentation

| Document | Content |
|---|---|
| [`docs/01-callback-assistant.md`](docs/01-callback-assistant.md) | Full architecture, components, sequence diagram, state machine, error handling |
| [`docs/02-flowchart.md`](docs/02-flowchart.md) | Process diagram |
| [`docs/03-implementation-general.md`](docs/03-implementation-general.md) | Framework-agnostic implementation spec (functional units, ports/contracts) |
| [`docs/Plans/04-Laravel_vs_NestJS.md`](docs/Plans/04-Laravel_vs_NestJS.md) | Framework comparison: Laravel vs NestJS |
| [`docs/Plans/03-why-not-n8n.md`](docs/Plans/03-why-not-n8n.md) | Rationale for not using n8n |

## Planned Implementation

The concrete implementation is expected to be built with **NestJS** (TypeScript / Node.js),
which was selected for its type safety, modular/enterprise architecture, excellent
scalability, and a unified JavaScript/TypeScript stack across backend and frontend.

The implementation follows the framework-agnostic functional units defined in
[`docs/03-implementation-general.md`](docs/03-implementation-general.md), with the core
depending only on the `CallProvider`, `Action`, `NotificationPort`, `CalendarPort`,
`RequestStore` and `CallDetailStore` contracts.

## Next Steps / Open Items

- Idempotent call initiation and dead-letter review once call volume grows
- GDPR: recording consent prompt at call start, retention policy, DPA with providers
- Working-hours and timezone handling (never call outside business hours)
- Observability: structured logging, metrics (success rate, latency, cost/call), alerting
- Security: rate limiting on the form, input sanitization, secrets management, TLS
- Admin dashboard for owners
- Testing: unit tests for validation/actions, integration tests with mocked VAPI
