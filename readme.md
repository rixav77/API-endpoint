# Agents Engineer: Endpoint Tester

**Role:** Agents Engineer | **Duration:** 90 minutes | **Format:** Hands-on implementation with Claude Code

---

## Overview

You are given a set of API endpoint definitions for **Gmail** and **Google Calendar**. Your job is to build an **agent** that validates each endpoint using `composio.execute()` and produces a structured test report.

The catch: **some of these endpoints are fake** — they don't actually exist in the Google API. Your agent needs to figure out which ones are real and which aren't, and also whether the connected account has sufficient scopes to call each endpoint.

**Important:** This is about building an **agent**, not a deterministic script. Your solution should reason about endpoints, handle dependencies between them, and make intelligent decisions — not just loop through a list and fire requests.

## Problem Statement

Build an agent that:

1. **Reads the endpoint definitions** from `src/endpoints.json` (16 total: 10 Gmail + 6 Google Calendar)
2. **Uses `composio.execute()`** to test each endpoint (NOT raw HTTP/curl — use Composio's execution layer)
3. **Handles dependencies between endpoints** — some endpoints need data from others (e.g., you need to list messages before you can get a specific message by ID)
4. **Classifies each endpoint** into one of these categories:
   - `valid` — endpoint exists and returns a successful response
   - `invalid_endpoint` — endpoint does not exist (404 or similar)
   - `insufficient_scopes` — endpoint exists but the connected account lacks required permissions (403)
   - `error` — unexpected failure (with details)
5. **Produces a structured test report** (JSON) summarizing results for all endpoints

### What the report should contain (per endpoint)

- Tool slug
- HTTP method and path
- Status classification (valid / invalid_endpoint / insufficient_scopes / error)
- HTTP status code received (if available)
- Response summary or error message
- Scopes that were required vs. scopes available

### Endpoint testing rules

- Every endpoint must be tested **independently** — don't skip an endpoint because a previous one failed
- For endpoints that require path parameters (e.g., `{messageId}`), your agent should fetch a real ID from a list endpoint first — this is a dependency your agent needs to reason about
- For endpoints that require a request body (POST), construct a minimal valid payload
- Handle rate limiting gracefully — don't fire all requests simultaneously

## Constraints

### You must use Claude Code with the MiniMax model

Everyone doing this assignment uses the same model so we evaluate your problem-solving, not your model budget.

**Setup:**

```bash
# Configure Claude Code to use MiniMax (Anthropic-compatible proxy)
export ANTHROPIC_BASE_URL="https://api.minimax.io/anthropic"
export ANTHROPIC_API_KEY="<MINIMAX_API_KEY provided to you>"

# Start Claude Code
claude
```

> MiniMax serves an Anthropic-compatible API, so Claude Code works with it out of the box. You just need the two env vars above.

### Tech stack

Use **Bun** (not Node.js). The project is already set up for Bun. You are free to use any libraries you want beyond that.

### Use `composio.execute()`, not raw HTTP

Do **not** construct raw HTTP requests or extract bearer tokens manually. Use Composio's `composio.execute()` method to call endpoints — it handles auth for you. This is the whole point of Composio's execution layer.

Example usage:

```typescript
import { Composio } from "@composio/core";

const composio = new Composio();

const result = await composio.execute({
  actionName: "GMAIL_LIST_MESSAGES",
  connectedAccountId: "<your_connected_account_id>",
  input: { maxResults: 5 },
});
```

## Getting Started

1. **Get your API keys** — you will be provided:
   - A Composio API key (for OAuth token management)
   - A MiniMax API key (for Claude Code)

2. **Run the setup script:**
   ```bash
   COMPOSIO_API_KEY=<your_key> MINIMAX_API_KEY=<your_minimax_key> sh setup.sh
   ```
   This handles everything: installs dependencies, creates auth configs, connects your Google account, and verifies the setup works.

3. **Explore the input data:**
   ```bash
   bun src/index.ts
   ```
   This prints a summary of all endpoints you need to test.

4. **Start Claude Code and build your agent:**
   ```bash
   export ANTHROPIC_BASE_URL="https://api.minimax.io/anthropic"
   export ANTHROPIC_API_KEY="<your_minimax_key>"
   claude
   ```

5. **Build your endpoint tester agent** — see requirements above.

## What We Provide

- `src/endpoints.json` — The endpoint definitions (your input data)
- `src/index.ts` — Prints a summary of all endpoints and hints about composio.execute()
- `src/connect.ts` — Connects your Google account via Composio OAuth
- `setup.sh` — One-command setup (dependencies, auth, OAuth, sanity check — calls `scaffold.sh` internally)
- OAuth credentials via Composio (managed auth)
- MiniMax API key for Claude Code

## What We Expect

By the end of the 90 minutes:

1. **A working agent** that tests all 16 endpoints and produces a structured report
2. **Correct classification** — invalid endpoints should be flagged as invalid, scope issues should be flagged as scope issues, fake endpoints should be caught
3. **A test report** (JSON file) with results for every endpoint
4. **Clean, readable code** — good abstractions, error handling, and separation of concerns
5. **Agent design** — your solution should demonstrate intelligent reasoning, not just a linear script that loops through endpoints
6. **A short video** (Loom, ~1 minute) explaining what you built, the decisions you made, and any tradeoffs

### Bonus (if time permits)

- A summary dashboard (terminal or web) showing pass/fail at a glance
- Retry logic for transient failures
- Parallel execution with rate-limit awareness
- Suggestions for which scopes are missing and what they would unlock

## How We Judge

1. **Correctness (30%)** — Does the agent accurately classify each endpoint? Are the fake endpoints caught?
2. **Completeness (25%)** — Are all 16 endpoints tested? Is the report structured and useful?
3. **Agent design (25%)** — Is this a real agent or just a loop? Does it reason about dependencies, handle edge cases, and use composio.execute() effectively? (We can see your agent session traces.)
4. **Code quality (20%)** — Is the code well-organized? Are there clean abstractions for execution, result classification, and reporting?

## How to Submit

1. **Record a short video** (~1 minute) on [Loom](https://loom.com) (free — screen + mic recording) explaining what you built, the decisions you made, and any tradeoffs.

2. **Submit your code and video:**
   ```bash
   sh upload.sh <your_email> <loom_video_url>
   ```

   This zips your project (excluding node_modules, .env, etc.) and uploads it along with your agent session traces.

---

*Good luck. We're evaluating how you think and build with an AI agent, not just the final output.*
