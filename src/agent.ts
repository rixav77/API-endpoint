/**
 * Composio Endpoint Tester Agent
 *
 * An intelligent agent that tests 16 API endpoints (10 Gmail + 6 Google Calendar)
 * using composio.tools.execute(), handles dependencies between endpoints,
 * classifies each result, and produces a structured JSON report.
 */

import {
    allEndpoints,
    createExecutionContext,
    DELAY_BETWEEN_REQUESTS_MS,
} from "./config";
import {
    getExecutionOrder,
    describeDependencies,
} from "./dependency-resolver";
import { testEndpoint } from "./executor";
import { buildReport, printDashboard, saveReport } from "./reporter";
import type { EndpointResult } from "./types";
import { resolve } from "path";

// --- ANSI helpers ---
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main agent logic
// ---------------------------------------------------------------------------

async function main() {
    const startTime = Date.now();

    console.log(`\n${BOLD}${CYAN}🤖 Composio Endpoint Tester Agent${RESET}`);
    console.log(`${DIM}${"━".repeat(50)}${RESET}\n`);

    // --- Step 1: Load and analyze endpoints ---
    console.log(`${BOLD}Step 1:${RESET} Analyzing ${allEndpoints.length} endpoints...\n`);

    const depMap = describeDependencies(allEndpoints);
    if (depMap.size > 0) {
        console.log(`${YELLOW}  Dependencies detected:${RESET}`);
        for (const [slug, deps] of depMap) {
            console.log(`    ${slug} → depends on: ${deps.join(", ")}`);
        }
        console.log("");
    }

    // --- Step 2: Determine execution order ---
    const ordered = getExecutionOrder(allEndpoints);
    console.log(`${BOLD}Step 2:${RESET} Execution order determined:\n`);
    for (let i = 0; i < ordered.length; i++) {
        const ep = ordered[i];
        const hasDeps = depMap.has(ep.tool_slug);
        const marker = hasDeps ? `${YELLOW}↳${RESET}` : " ";
        console.log(
            `  ${DIM}${String(i + 1).padStart(2)}.${RESET} ${marker} ${ep.method.padEnd(6)} ${ep.tool_slug}`
        );
    }
    console.log("");

    // --- Step 3: Execute endpoints sequentially ---
    console.log(`${BOLD}Step 3:${RESET} Testing endpoints...\n`);

    const ctx = createExecutionContext();
    const results: EndpointResult[] = [];

    for (let i = 0; i < ordered.length; i++) {
        const ep = ordered[i];
        const progress = `[${String(i + 1).padStart(2)}/${ordered.length}]`;

        process.stdout.write(
            `  ${DIM}${progress}${RESET} Testing ${BOLD}${ep.tool_slug}${RESET}... `
        );

        const result = await testEndpoint(ep, ctx);
        results.push(result);

        // Print status inline
        const statusIcons: Record<string, string> = {
            valid: `${GREEN}✓ valid${RESET}`,
            invalid_endpoint: `${RED}✗ invalid${RESET}`,
            insufficient_scopes: `${YELLOW}⚠ no scope${RESET}`,
            error: `${RED}● error${RESET}`,
        };
        console.log(statusIcons[result.status] || result.status);

        // Rate limiting — wait between requests
        if (i < ordered.length - 1) {
            await sleep(DELAY_BETWEEN_REQUESTS_MS);
        }
    }

    // --- Step 4: Build and save report ---
    console.log(`\n${BOLD}Step 4:${RESET} Generating report...\n`);

    const report = buildReport(results);
    const reportPath = resolve(import.meta.dir, "report.json");
    await saveReport(report, reportPath);

    console.log(`  ${GREEN}✓${RESET} Report saved to ${DIM}${reportPath}${RESET}`);

    // --- Step 5: Display dashboard ---
    printDashboard(report);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  ${DIM}Completed in ${elapsed}s${RESET}\n`);
}

// --- Run ---
main().catch((err) => {
    console.error(`\n${RED}${BOLD}Fatal error:${RESET}`, err);
    process.exit(1);
});
