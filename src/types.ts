/**
 * Shared types for the Composio Endpoint Tester Agent
 */

// --- Endpoint definition types (matches endpoints.json shape) ---

export interface EndpointParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface EndpointBody {
  content_type: string;
  fields: EndpointParam[];
}

export interface EndpointParameters {
  query: EndpointParam[];
  path: EndpointParam[];
  body: EndpointBody | null;
}

export interface EndpointDef {
  tool_slug: string;
  description: string;
  method: string;
  path: string;
  required_scopes: string[];
  parameters: EndpointParameters;
}

export interface ServiceGroup {
  base_url: string;
  endpoints: EndpointDef[];
}

export interface EndpointsFile {
  gmail: ServiceGroup;
  googlecalendar: ServiceGroup;
}

// --- Test result types ---

export type StatusClassification =
  | "valid"
  | "invalid_endpoint"
  | "insufficient_scopes"
  | "error";

export interface EndpointResult {
  toolSlug: string;
  method: string;
  path: string;
  status: StatusClassification;
  httpStatusCode: number | null;
  responseSummary: string;
  scopesRequired: string[];
  scopesAvailable: string[];
}

export interface TestReport {
  generatedAt: string;
  totalEndpoints: number;
  summary: {
    valid: number;
    invalid_endpoint: number;
    insufficient_scopes: number;
    error: number;
  };
  results: EndpointResult[];
}

// --- Execution context (shared state for dependency resolution) ---

export interface ExecutionContext {
  /** Gmail message IDs fetched from LIST_MESSAGES */
  messageIds: string[];
  /** Gmail thread IDs fetched from LIST_THREADS */
  threadIds: string[];
  /** Calendar event IDs fetched from LIST_EVENTS */
  eventIds: string[];
  /** Event ID created by the agent (safe to delete) */
  createdEventId: string | null;
  /** User's email address from GET_PROFILE */
  userEmail: string | null;
}
