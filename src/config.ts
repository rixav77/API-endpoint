/**
 * Configuration and Composio client initialization
 */

import { Composio } from "@composio/core";
import endpoints from "./endpoints.json";
import type { EndpointDef, EndpointsFile, ExecutionContext } from "./types";

// --- Environment ---
const MOCK_MODE = process.env.MOCK_COMPOSIO === "true";

// --- Composio client ---
// In mock mode, we provide a dummy key to prevent initialization failure
export const composio = new Composio({
    apiKey: process.env.COMPOSIO_API_KEY || (MOCK_MODE ? "mock_key_12345" : undefined),
});

// --- Constants ---
export const CONNECTED_ACCOUNT_ID = "candidate";
export const DELAY_BETWEEN_REQUESTS_MS = 1200;
export const MAX_RETRIES = 2;
export const RETRY_DELAY_MS = 2500;

// --- Load endpoints ---
const data = endpoints as EndpointsFile;
export const gmailEndpoints: EndpointDef[] = data.gmail.endpoints;
export const calendarEndpoints: EndpointDef[] = data.googlecalendar.endpoints;
export const allEndpoints: EndpointDef[] = [
    ...gmailEndpoints,
    ...calendarEndpoints,
];

// --- Fresh execution context ---
export function createExecutionContext(): ExecutionContext {
    return {
        messageIds: [],
        threadIds: [],
        eventIds: [],
        createdEventId: null,
        userEmail: null,
    };
}
