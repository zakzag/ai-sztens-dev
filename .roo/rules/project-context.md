# Project context

## What this project is

**Callback Assistant** — an automated call-back system. A website visitor submits a call-back
request through a form; the backend validates and stores it, then a worker initiates an
AI-driven phone call (speech-to-text / text-to-speech / LLM conversation), processes the
result and runs configurable follow-up actions (owner notification, calendar booking
proposal, CRM hooks, ...).

Key principle: **external services are executors, the backend is the decision maker**.
All meaningful data (statuses, transcripts, summaries, recordings) is written back into our
own database through webhooks — the voice provider is never the source of truth.
