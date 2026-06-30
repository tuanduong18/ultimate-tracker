# 1. Decoupled Next.js frontend and FastAPI backend

- Status: Accepted
- Date: 2026-06-30

## Context

Ultimate Tracker spans seven data domains and needs a place for non-request
logic: scheduled jobs (weekly digest) and the cross-domain correlation engine.
We had to choose between a Next.js full-stack app (API routes) and a separate
backend service.

## Decision

Use a decoupled architecture: a Next.js frontend (Vercel) talking over REST to a
FastAPI backend (Render), with Supabase providing Postgres and Auth. The backend
verifies Supabase-issued JWTs and owns all business logic and scheduled tasks.

## Consequences

- Async-native Python, automatic OpenAPI docs, and a clean home for the
  correlation engine and background jobs.
- Mirrors how real backend teams are structured — valuable for a portfolio piece.
- Cost: two deploy targets and a network hop between frontend and backend, plus
  the need to keep TypeScript types in sync with the API contract.

See `DeveloperGuide.md` §1 for the full rationale.
