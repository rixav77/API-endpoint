/**
 * Dependency Resolver — determines execution order based on endpoint dependencies.
 *
 * Some endpoints require path parameters (e.g., {messageId}, {eventId}) that can
 * only be obtained by calling a "list" or "create" endpoint first. This module
 * builds a dependency graph and returns a topologically sorted execution order.
 */

import type { EndpointDef } from "./types";

/** Map of path parameter → tool slug that provides it */
const PARAM_PROVIDERS: Record<string, string> = {
    messageId: "GMAIL_LIST_MESSAGES",
    eventId: "GOOGLECALENDAR_LIST_EVENTS",
};

/**
 * Special override: GOOGLECALENDAR_DELETE_EVENT should use an event created by
 * the agent (not from the user's calendar) to avoid destructive side effects.
 */
const DELETE_EVENT_PROVIDER = "GOOGLECALENDAR_CREATE_EVENT";

interface DependencyInfo {
    endpoint: EndpointDef;
    dependsOn: string[]; // tool_slugs this endpoint depends on
    pathParams: string[]; // which path params it needs
}

/**
 * Analyze all endpoints and build dependency metadata.
 */
function analyzeDependencies(endpoints: EndpointDef[]): DependencyInfo[] {
    const slugSet = new Set(endpoints.map((e) => e.tool_slug));

    return endpoints.map((endpoint) => {
        const pathParams = endpoint.parameters.path.map((p) => p.name);
        const dependsOn: string[] = [];

        // Special case: DELETE_EVENT depends on CREATE_EVENT
        if (endpoint.tool_slug === "GOOGLECALENDAR_DELETE_EVENT") {
            if (slugSet.has(DELETE_EVENT_PROVIDER)) {
                dependsOn.push(DELETE_EVENT_PROVIDER);
            }
        } else {
            // General case: find provider for each path param
            for (const param of pathParams) {
                const provider = PARAM_PROVIDERS[param];
                if (provider && slugSet.has(provider)) {
                    dependsOn.push(provider);
                }
            }
        }

        return { endpoint, dependsOn, pathParams };
    });
}

/**
 * Topological sort — endpoints with no dependencies come first,
 * then endpoints whose dependencies have already been processed.
 */
export function getExecutionOrder(endpoints: EndpointDef[]): EndpointDef[] {
    const deps = analyzeDependencies(endpoints);
    const depsMap = new Map<string, DependencyInfo>();
    for (const d of deps) {
        depsMap.set(d.endpoint.tool_slug, d);
    }

    const sorted: EndpointDef[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>(); // cycle detection

    function visit(slug: string) {
        if (visited.has(slug)) return;
        if (visiting.has(slug)) return; // cycle — just skip
        visiting.add(slug);

        const info = depsMap.get(slug);
        if (info) {
            for (const dep of info.dependsOn) {
                visit(dep);
            }
            sorted.push(info.endpoint);
        }

        visiting.delete(slug);
        visited.add(slug);
    }

    for (const d of deps) {
        visit(d.endpoint.tool_slug);
    }

    return sorted;
}

/**
 * Returns human-readable dependency info for logging.
 */
export function describeDependencies(
    endpoints: EndpointDef[]
): Map<string, string[]> {
    const deps = analyzeDependencies(endpoints);
    const result = new Map<string, string[]>();
    for (const d of deps) {
        if (d.dependsOn.length > 0) {
            result.set(d.endpoint.tool_slug, d.dependsOn);
        }
    }
    return result;
}
