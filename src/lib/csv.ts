/**
 * Phase 7 (7c) — CSV serialization for the admin export endpoints.
 *
 * Minimal RFC-4180-ish escaping: wrap any cell that contains a comma,
 * quote, newline, or CR in double-quotes; double any embedded quotes.
 * Dates are stamped ISO-8601. Null/undefined render as empty string.
 */
export type CsvCell = string | number | boolean | Date | null | undefined;

function escapeCell(v: CsvCell): string {
    if (v === null || v === undefined) return "";
    let s: string;
    if (v instanceof Date) s = v.toISOString();
    else if (typeof v === "number") s = Number.isFinite(v) ? String(v) : "";
    else if (typeof v === "boolean") s = v ? "true" : "false";
    else s = String(v);
    if (/[,"\r\n]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
    const lines: string[] = [];
    lines.push(headers.map(escapeCell).join(","));
    for (const r of rows) lines.push(r.map(escapeCell).join(","));
    // Trailing newline so the file plays nice with `tail`, `cat`, etc.
    return lines.join("\n") + "\n";
}

/** Build a Response that triggers a browser download. */
export function csvResponse(filename: string, body: string): Response {
    return new Response(body, {
        status: 200,
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
        },
    });
}
