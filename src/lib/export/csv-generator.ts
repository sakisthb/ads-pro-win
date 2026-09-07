// CSV generation + browser download helpers.
// Task #31 (F4 Export/Reports) — everything runs client-side; there is no
// server round-trip, so these helpers are safe to call from any "use client"
// component event handler.

/** Escape a single CSV cell: wrap in quotes and double any embedded quotes. */
function escapeCell(cell: string | number): string {
  return `"${String(cell).replace(/"/g, '""')}"`;
}

/**
 * Generate a single-table CSV Blob.
 *
 * @param headers Column labels for the first row.
 * @param rows    Data rows; every cell is stringified and quote-escaped so
 *                commas, quotes and newlines inside values stay intact.
 */
export function generateCSV(
  headers: string[],
  rows: (string | number)[][],
): Blob {
  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ];
  return new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
}

/** One titled table inside a multi-section CSV document. */
export interface CSVSection {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

/**
 * Generate a multi-section CSV Blob: every section renders as a `# Title`
 * comment line followed by its own header + data rows, with blank lines
 * between sections so spreadsheet apps keep the tables visually distinct.
 */
export function generateMultiSectionCSV(sections: CSVSection[]): Blob {
  const lines: string[] = [];
  sections.forEach((section, index) => {
    if (index > 0) lines.push("");
    lines.push(`# ${section.title}`);
    lines.push(section.headers.map(escapeCell).join(","));
    for (const row of section.rows) {
      lines.push(row.map(escapeCell).join(","));
    }
  });
  return new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
}

/** Trigger a browser download for a generated Blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
