/**
 * Reporter — generates the JSON report and prints a terminal dashboard.
 */

import type { EndpointResult, StatusClassification, TestReport } from "./types";

// --- ANSI color codes ---
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";
const WHITE = "\x1b[37m";
const BG_GREEN = "\x1b[42m";
const BG_RED = "\x1b[41m";
const BG_YELLOW = "\x1b[43m";

const STATUS_COLORS: Record<StatusClassification, string> = {
    valid: GREEN,
    invalid_endpoint: RED,
    insufficient_scopes: YELLOW,
    error: MAGENTA,
};

const STATUS_ICONS: Record<StatusClassification, string> = {
    valid: "✓",
    invalid_endpoint: "✗",
    insufficient_scopes: "⚠",
    error: "●",
};

// ---------------------------------------------------------------------------
// Build report object
// ---------------------------------------------------------------------------

export function buildReport(results: EndpointResult[]): TestReport {
    const summary = { valid: 0, invalid_endpoint: 0, insufficient_scopes: 0, error: 0 };
    for (const r of results) {
        summary[r.status]++;
    }

    return {
        generatedAt: new Date().toISOString(),
        totalEndpoints: results.length,
        summary,
        results,
    };
}

// ---------------------------------------------------------------------------
// Save report to disk
// ---------------------------------------------------------------------------

export async function saveReport(
    report: TestReport,
    path: string
): Promise<void> {
    await Bun.write(path, JSON.stringify(report, null, 2));
}

// ---------------------------------------------------------------------------
// Terminal dashboard
// ---------------------------------------------------------------------------

export function printDashboard(report: TestReport): void {
    const { results, summary } = report;

    console.log("\n");
    console.log(
        `${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${RESET}`
    );
    console.log(
        `${BOLD}${CYAN}║                     ENDPOINT TESTER — RESULTS DASHBOARD                    ║${RESET}`
    );
    console.log(
        `${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${RESET}`
    );

    // --- Summary bar ---
    console.log("");
    console.log(`  ${BOLD}Summary${RESET}  ${DIM}(${report.totalEndpoints} endpoints tested)${RESET}`);
    console.log(
        `  ${GREEN}${BOLD}${summary.valid} valid${RESET}  │  ` +
        `${RED}${BOLD}${summary.invalid_endpoint} invalid${RESET}  │  ` +
        `${YELLOW}${BOLD}${summary.insufficient_scopes} insufficient scopes${RESET}  │  ` +
        `${MAGENTA}${BOLD}${summary.error} errors${RESET}`
    );

    // --- Results table ---
    console.log("");
    console.log(
        `  ${DIM}${"─".repeat(74)}${RESET}`
    );
    console.log(
        `  ${BOLD}${WHITE}  Status  │ Method │ Tool Slug                           │ HTTP${RESET}`
    );
    console.log(
        `  ${DIM}${"─".repeat(74)}${RESET}`
    );

    for (const r of results) {
        const color = STATUS_COLORS[r.status];
        const icon = STATUS_ICONS[r.status];
        const statusLabel = r.status.padEnd(7);
        const method = r.method.padEnd(6);
        const slug = r.toolSlug.padEnd(35);
        const httpCode = r.httpStatusCode ? String(r.httpStatusCode) : " — ";

        console.log(
            `  ${color}${icon} ${statusLabel}${RESET} │ ${method} │ ${slug} │ ${httpCode}`
        );
    }

    console.log(
        `  ${DIM}${"─".repeat(74)}${RESET}`
    );

    // --- Scope suggestions ---
    const scopeIssues = results.filter((r) => r.status === "insufficient_scopes");
    if (scopeIssues.length > 0) {
        console.log("");
        console.log(`  ${YELLOW}${BOLD}⚠ Missing Scopes Suggestions${RESET}`);
        for (const r of scopeIssues) {
            console.log(
                `    ${r.toolSlug}: needs ${r.scopesRequired.join(", ") || "unknown"}`
            );
        }
    }

    // --- Fake endpoints ---
    const fakeEndpoints = results.filter((r) => r.status === "invalid_endpoint");
    if (fakeEndpoints.length > 0) {
        console.log("");
        console.log(`  ${RED}${BOLD}✗ Invalid/Fake Endpoints Detected${RESET}`);
        for (const r of fakeEndpoints) {
            console.log(`    ${r.toolSlug} — ${r.path}`);
        }
    }

    console.log("");
    console.log(`  ${DIM}Report saved at ${report.generatedAt}${RESET}`);
    console.log("");
}
