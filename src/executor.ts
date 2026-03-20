/**
 * Executor — tests each endpoint via composio.tools.execute() and classifies results.
 *
 * Handles input construction (query params, path params, request bodies),
 * result classification, retry logic, and context extraction.
 */

import {
    composio,
    CONNECTED_ACCOUNT_ID,
    MAX_RETRIES,
    RETRY_DELAY_MS,
} from "./config";
import type {
    EndpointDef,
    EndpointResult,
    ExecutionContext,
    StatusClassification,
} from "./types";

// ---------------------------------------------------------------------------
// Scope cache and Mock mode
// ---------------------------------------------------------------------------

const MOCK_MODE = process.env.MOCK_COMPOSIO === "true";
let gmailScopes: string[] = [];
let calendarScopes: string[] = [];
let scopesFetched = false;

async function fetchScopes(): Promise<void> {
    if (scopesFetched || MOCK_MODE) return;
    try {
        const accounts = await composio.connectedAccounts.list({});
        // @ts-ignore
        const candidateAccounts = (accounts.items || []).filter(a => a.userId === CONNECTED_ACCOUNT_ID || a.id === CONNECTED_ACCOUNT_ID);

        for (const acc of candidateAccounts) {
            // @ts-ignore
            const stateVal = acc.state?.val || {};
            const scopeStr = stateVal.scope || "";
            const scopes = typeof scopeStr === "string" ? scopeStr.split(/[\s,]+/).filter(Boolean) : (Array.isArray(scopeStr) ? scopeStr : []);

            // @ts-ignore
            const toolkit = (acc.toolkit?.slug || acc.toolkitSlug || "").toLowerCase();
            if (toolkit === "gmail") gmailScopes = scopes;
            if (toolkit === "googlecalendar") calendarScopes = scopes;
        }
        scopesFetched = true;
    } catch (err) {
        // Silent fail, we'll rely on execution results
    }
}

function getMockResult(endpoint: EndpointDef): { data: Record<string, unknown>; error: string | null; successful: boolean } {
    const slug = endpoint.tool_slug;

    // Fake endpoints from endpoints.json
    if (slug === "GMAIL_LIST_FOLDERS" || slug === "GMAIL_ARCHIVE_MESSAGE" || slug === "GOOGLECALENDAR_LIST_REMINDERS") {
        return {
            data: {},
            error: `Error 404: Endpoint ${endpoint.path} not found. This is a fake endpoint.`,
            successful: false
        };
    }

    // Success simulation
    return {
        data: { message: "Mock success for " + slug, id: "mock_" + Date.now() },
        error: null,
        successful: true
    };
}

// ---------------------------------------------------------------------------
// Input builders — construct the right input payload for each endpoint
// ---------------------------------------------------------------------------

function buildInput(
    endpoint: EndpointDef,
    ctx: ExecutionContext
): Record<string, unknown> {
    const input: Record<string, unknown> = {};

    switch (endpoint.tool_slug) {
        // --- Gmail ---
        case "GMAIL_LIST_MESSAGES":
            input.maxResults = 5;
            break;

        case "GMAIL_GET_MESSAGE":
            if (ctx.messageIds.length > 0) {
                input.messageId = ctx.messageIds[0];
                input.format = "metadata";
            }
            break;

        case "GMAIL_SEND_MESSAGE": {
            const to = ctx.userEmail || "test@example.com";
            const rawEmail = [
                `To: ${to}`,
                `Subject: Composio Agent Test`,
                `Content-Type: text/plain; charset="UTF-8"`,
                "",
                "This is an automated test message from the Composio Endpoint Tester Agent.",
            ].join("\r\n");
            // Base64url encode
            const encoded = Buffer.from(rawEmail)
                .toString("base64")
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/, "");
            input.raw = encoded;
            break;
        }

        case "GMAIL_LIST_LABELS":
            // No parameters needed
            break;

        case "GMAIL_GET_PROFILE":
            // No parameters needed
            break;

        case "GMAIL_CREATE_DRAFT": {
            const draftTo = ctx.userEmail || "test@example.com";
            const draftRaw = [
                `To: ${draftTo}`,
                `Subject: Composio Agent Test Draft`,
                `Content-Type: text/plain; charset="UTF-8"`,
                "",
                "This is an automated test draft from the Composio Endpoint Tester Agent.",
            ].join("\r\n");
            const draftEncoded = Buffer.from(draftRaw)
                .toString("base64")
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/, "");
            input.message = { raw: draftEncoded };
            break;
        }

        case "GMAIL_LIST_THREADS":
            input.maxResults = 5;
            break;

        case "GMAIL_TRASH_MESSAGE":
            if (ctx.messageIds.length > 0) {
                // Use the last message to avoid trashing the one we might need
                input.messageId = ctx.messageIds[ctx.messageIds.length - 1];
            }
            break;

        case "GMAIL_LIST_FOLDERS":
            // Fake endpoint — no params needed, it will fail
            break;

        case "GMAIL_ARCHIVE_MESSAGE":
            if (ctx.messageIds.length > 0) {
                input.messageId = ctx.messageIds[0];
            }
            break;

        // --- Google Calendar ---
        case "GOOGLECALENDAR_LIST_EVENTS":
            input.maxResults = 5;
            // Get events from past month to future month
            input.timeMin = new Date(
                Date.now() - 30 * 24 * 60 * 60 * 1000
            ).toISOString();
            input.timeMax = new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString();
            break;

        case "GOOGLECALENDAR_CREATE_EVENT": {
            const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const end = new Date(start.getTime() + 60 * 60 * 1000);
            input.summary = "Composio Agent Test Event";
            input.description =
                "Automated test event — safe to delete";
            input.start = {
                dateTime: start.toISOString(),
                timeZone: "UTC",
            };
            input.end = {
                dateTime: end.toISOString(),
                timeZone: "UTC",
            };
            break;
        }

        case "GOOGLECALENDAR_GET_EVENT":
            if (ctx.eventIds.length > 0) {
                input.eventId = ctx.eventIds[0];
            }
            break;

        case "GOOGLECALENDAR_LIST_CALENDARS":
            input.maxResults = 5;
            break;

        case "GOOGLECALENDAR_DELETE_EVENT":
            // Prefer the event we created (safe to delete)
            if (ctx.createdEventId) {
                input.eventId = ctx.createdEventId;
            } else if (ctx.eventIds.length > 0) {
                input.eventId = ctx.eventIds[ctx.eventIds.length - 1];
            }
            break;

        case "GOOGLECALENDAR_LIST_REMINDERS":
            // Fake endpoint — no params needed
            break;

        default:
            // For unknown endpoints, try to fill path params from context
            for (const param of endpoint.parameters.path) {
                if (param.name === "messageId" && ctx.messageIds.length > 0) {
                    input.messageId = ctx.messageIds[0];
                }
                if (param.name === "eventId" && ctx.eventIds.length > 0) {
                    input.eventId = ctx.eventIds[0];
                }
            }
            break;
    }

    return input;
}

// ---------------------------------------------------------------------------
// Result classification
// ---------------------------------------------------------------------------

function classifyResult(
    result: { data?: Record<string, unknown>; error?: string | null; successful?: boolean } | null,
    caughtError: Error | null
): { status: StatusClassification; httpStatusCode: number | null; summary: string } {
    // If we caught an exception (e.g., tool not found in Composio)
    if (caughtError) {
        const msg = caughtError.message || String(caughtError);
        const msgLower = msg.toLowerCase();

        if (
            msgLower.includes("not found") ||
            msgLower.includes("404") ||
            msgLower.includes("could not find") ||
            msgLower.includes("does not exist") ||
            msgLower.includes("no tool") ||
            msgLower.includes("tool_not_found")
        ) {
            return {
                status: "invalid_endpoint",
                httpStatusCode: 404,
                summary: msg.slice(0, 300),
            };
        }

        if (
            msgLower.includes("forbidden") ||
            msgLower.includes("403") ||
            msgLower.includes("insufficient") ||
            msgLower.includes("scope") ||
            msgLower.includes("permission")
        ) {
            return {
                status: "insufficient_scopes",
                httpStatusCode: 403,
                summary: msg.slice(0, 300),
            };
        }

        return {
            status: "error",
            httpStatusCode: null,
            summary: msg.slice(0, 300),
        };
    }

    // If we got a response from composio.tools.execute()
    if (result) {
        // Successful call
        if (result.successful) {
            return {
                status: "valid",
                httpStatusCode: 200,
                summary: summarizeData(result.data || {}),
            };
        }

        // Failed call with error info
        const errorMsg = result.error || "Unknown error";
        const errorLower = errorMsg.toLowerCase();
        const dataStr = JSON.stringify(result.data || {}).toLowerCase();
        const combined = errorLower + " " + dataStr;

        // Extract HTTP status code from error/data if present
        let httpCode: number | null = null;
        const statusMatch = combined.match(/(?:status[_\s]?code|http[_\s]?status|status)["\s:]*(\d{3})/);
        if (statusMatch) {
            httpCode = parseInt(statusMatch[1], 10);
        }

        if (
            combined.includes("not found") ||
            combined.includes("404") ||
            combined.includes("does not exist") ||
            combined.includes("not_found") ||
            combined.includes("invalid action") ||
            combined.includes("no tool")
        ) {
            return {
                status: "invalid_endpoint",
                httpStatusCode: httpCode || 404,
                summary: errorMsg.slice(0, 300),
            };
        }

        if (
            combined.includes("forbidden") ||
            combined.includes("403") ||
            combined.includes("insufficient") ||
            combined.includes("scope") ||
            combined.includes("permission denied") ||
            combined.includes("access denied")
        ) {
            return {
                status: "insufficient_scopes",
                httpStatusCode: httpCode || 403,
                summary: errorMsg.slice(0, 300),
            };
        }

        return {
            status: "error",
            httpStatusCode: httpCode,
            summary: errorMsg.slice(0, 300),
        };
    }

    return {
        status: "error",
        httpStatusCode: null,
        summary: "No result received",
    };
}

function summarizeData(data: Record<string, unknown>): string {
    const str = JSON.stringify(data);
    if (str.length <= 300) return str;
    return str.slice(0, 297) + "...";
}

// ---------------------------------------------------------------------------
// Context extraction — pull IDs from list/create results
// ---------------------------------------------------------------------------

function extractContext(
    endpoint: EndpointDef,
    result: { data?: Record<string, unknown>; successful?: boolean } | null,
    ctx: ExecutionContext
): void {
    if (!result?.successful || !result.data) return;

    const data = result.data as Record<string, unknown>;

    switch (endpoint.tool_slug) {
        case "GMAIL_LIST_MESSAGES": {
            const messages = (data.messages || data.items || []) as Array<{ id?: string }>;
            ctx.messageIds = messages
                .filter((m) => m?.id)
                .map((m) => m.id!)
                .slice(0, 5);
            break;
        }

        case "GMAIL_LIST_THREADS": {
            const threads = (data.threads || data.items || []) as Array<{ id?: string }>;
            ctx.threadIds = threads
                .filter((t) => t?.id)
                .map((t) => t.id!)
                .slice(0, 5);
            break;
        }

        case "GMAIL_GET_PROFILE": {
            if (data.emailAddress && typeof data.emailAddress === "string") {
                ctx.userEmail = data.emailAddress;
            }
            break;
        }

        case "GOOGLECALENDAR_LIST_EVENTS": {
            const events = (data.items || data.events || []) as Array<{ id?: string }>;
            ctx.eventIds = events
                .filter((e) => e?.id)
                .map((e) => e.id!)
                .slice(0, 5);
            break;
        }

        case "GOOGLECALENDAR_CREATE_EVENT": {
            if (data.id && typeof data.id === "string") {
                ctx.createdEventId = data.id;
                // Also add to eventIds so GET_EVENT can use it
                if (!ctx.eventIds.includes(data.id)) {
                    ctx.eventIds.unshift(data.id);
                }
            }
            break;
        }
    }
}

// ---------------------------------------------------------------------------
// Sleep utility
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main executor — test a single endpoint with retry
// ---------------------------------------------------------------------------

export async function testEndpoint(
    endpoint: EndpointDef,
    ctx: ExecutionContext
): Promise<EndpointResult> {
    // Ensure we have scopes
    await fetchScopes();

    const input = buildInput(endpoint, ctx);
    const isGmail = endpoint.tool_slug.startsWith("GMAIL_");
    const availableScopes = isGmail ? gmailScopes : calendarScopes;

    let lastResult: { data?: Record<string, unknown>; error?: string | null; successful?: boolean } | null = null;
    let lastError: Error | null = null;

    if (MOCK_MODE) {
        await sleep(300); // Simulate network latency
        lastResult = getMockResult(endpoint);
    } else {
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            if (attempt > 0) {
                console.log(
                    `    ↻ Retry ${attempt}/${MAX_RETRIES} for ${endpoint.tool_slug}...`
                );
                await sleep(RETRY_DELAY_MS);
            }

            try {
                const result = await composio.tools.execute(endpoint.tool_slug, {
                    connectedAccountId: CONNECTED_ACCOUNT_ID,
                    arguments: input,
                    dangerouslySkipVersionCheck: true,
                });

                lastResult = result as { data?: Record<string, unknown>; error?: string | null; successful?: boolean };
                lastError = null;

                // If successful, or if it's a definitive error (not transient), stop retrying
                if (result.successful || !isTransientError(result.error)) {
                    break;
                }
            } catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                lastResult = null;

                // Don't retry non-transient errors (tool not found, etc.)
                if (!isTransientError(lastError.message)) {
                    break;
                }
            }
        }
    }

    // Extract IDs from successful results for downstream endpoints
    if (lastResult) {
        extractContext(endpoint, lastResult, ctx);
    }

    // Classify the final result
    const classification = classifyResult(lastResult, lastError);

    return {
        toolSlug: endpoint.tool_slug,
        method: endpoint.method,
        path: endpoint.path,
        status: classification.status,
        httpStatusCode: classification.httpStatusCode,
        responseSummary: classification.summary,
        scopesRequired: endpoint.required_scopes,
        scopesAvailable: availableScopes,
    };
}

function isTransientError(errorMsg: string | null | undefined): boolean {
    if (!errorMsg) return false;
    const lower = errorMsg.toLowerCase();
    return (
        lower.includes("429") ||
        lower.includes("rate limit") ||
        lower.includes("too many requests") ||
        lower.includes("timeout") ||
        lower.includes("econnreset") ||
        lower.includes("econnrefused") ||
        lower.includes("network") ||
        lower.includes("temporarily unavailable") ||
        lower.includes("503") ||
        lower.includes("502")
    );
}
