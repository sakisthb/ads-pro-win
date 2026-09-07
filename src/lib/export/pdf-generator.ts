// Branded PDF report generation via jsPDF + jspdf-autotable.
// Task #31 (F4 Export/Reports) — client-side only. Import this module lazily
// (`await import(...)`) from event handlers: jsPDF is heavy, and a dynamic
// import keeps it out of the SSR bundle and the initial JS payload.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** An additional titled table appended after the primary report table. */
export interface PDFReportSection {
  title: string;
  tableHeaders: string[];
  tableRows: (string | number)[][];
}

export interface PDFReportParams {
  title: string;
  dateRange: string;
  orgName: string;
  summary: { label: string; value: string }[];
  tableHeaders: string[];
  tableRows: (string | number)[][];
  /** Optional extra tables (e.g. top campaigns) rendered after the primary one. */
  sections?: PDFReportSection[];
}

// -- Brand palette (matches the app's dark UI) --------------------------------
const HEADER_BG: [number, number, number] = [24, 24, 39]; // gray-950 band
const ACCENT: [number, number, number] = [124, 58, 237]; // violet-600 strip
const HEAD_FILL: [number, number, number] = [30, 30, 50]; // table head
const TEXT_PRIMARY: [number, number, number] = [31, 31, 42];
const TEXT_MUTED: [number, number, number] = [110, 110, 130];
const ZEBRA: [number, number, number] = [245, 245, 250];

/** Read the Y coordinate where the last autoTable finished drawing. */
function lastTableFinalY(doc: jsPDF, fallback: number): number {
  const table = (
    doc as unknown as { lastAutoTable?: { finalY?: number } }
  ).lastAutoTable;
  return table?.finalY ?? fallback;
}

/** Shared autoTable options so every table in the report looks the same. */
function tableOptions(startY: number, headers: string[], rows: (string | number)[][]) {
  return {
    startY,
    head: [headers],
    body: rows.map((row) => row.map(String)),
    theme: "grid" as const,
    headStyles: { fillColor: HEAD_FILL, textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: TEXT_PRIMARY },
    alternateRowStyles: { fillColor: ZEBRA },
    margin: { left: 14, right: 14 },
  };
}

/**
 * Generate a branded PDF report as a Blob.
 *
 * Layout: dark header band (title + org | date range), a summary stat list,
 * the primary table, any extra `sections`, and a footer with org name,
 * generation timestamp and page numbers on every page.
 */
export function generatePDFReport(params: PDFReportParams): Blob {
  const doc = new jsPDF();

  // -- Branded header band ----------------------------------------------------
  doc.setFillColor(...HEADER_BG);
  doc.rect(0, 0, 210, 36, "F");
  doc.setFillColor(...ACCENT);
  doc.rect(0, 36, 210, 1.4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(params.title, 14, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(165, 180, 252); // indigo-300
  doc.text(`${params.orgName}  |  ${params.dateRange}`, 14, 26);

  // -- Summary stats -----------------------------------------------------------
  let y = 48;
  doc.setTextColor(...TEXT_PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Summary", 14, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const { label, value } of params.summary) {
    doc.setTextColor(...TEXT_MUTED);
    doc.text(label, 14, y);
    doc.setTextColor(...TEXT_PRIMARY);
    doc.text(String(value), 196, y, { align: "right" });
    y += 6;
  }

  // -- Primary table ------------------------------------------------------------
  autoTable(doc, tableOptions(y + 4, params.tableHeaders, params.tableRows));

  // -- Additional sections --------------------------------------------------------
  for (const section of params.sections ?? []) {
    const after = lastTableFinalY(doc, y);
    if (after > 248) {
      doc.addPage();
      y = 20;
    } else {
      y = after;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...TEXT_PRIMARY);
    doc.text(section.title, 14, y + 8);
    autoTable(doc, tableOptions(y + 12, section.tableHeaders, section.tableRows));
  }

  // -- Footer on every page --------------------------------------------------------
  const pageCount = doc.getNumberOfPages();
  const generatedAt = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 160);
    doc.text(`${params.orgName} · Confidential`, 14, 291);
    doc.text(`Generated ${generatedAt} · Page ${page} of ${pageCount}`, 196, 291, {
      align: "right",
    });
  }

  return doc.output("blob");
}
