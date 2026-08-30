/**
 * lib/parseSupplierExcel.ts
 *
 * Parses a supplier-completed IBM audit checklist Excel workbook.
 *
 * Layout per section tab (S2, S3, … S8, etc.):
 *   Row 1      : "System Checklist"
 *   Row 3      : Section header cell in col A — e.g. "S8"
 *   Row 4      : Column headers  A=#  B=Question  C=Y/N  D=N/A  E=Supplier comment
 *   Row 5+     : One question per row
 *
 * Col C = Y/N answer  ("Y", "y", "x", "X", or any truthy text → "Y")
 * Col D = N/A answer  ("x", "X", or any truthy text → "N/A")
 * Col E = Supplier comment / remark
 *
 * Cell highlight colour is read from the fill — yellow (#FFFF00 family) means
 * the supplier or template author flagged that row.
 *
 * Tab "S1. Site information" is parsed separately for supplier profile fields.
 * Tabs named "Doc History", "Doc history", or starting with "Doc" are skipped.
 */

import { Workbook } from "exceljs";

export interface SupplierResponseRow {
  section: string;       // e.g. "S8 — Document control & PCN"
  questionNo: string;    // Col A value, e.g. "1", "2"
  questionText: string;  // Col B
  answer: "Y" | "N" | "N/A" | "";  // derived from cols C + D
  comment: string;       // Col E
  highlighted: boolean;  // cell fill is yellow / amber
}

export interface SupplierSiteInfo {
  [field: string]: string;
}

export interface ParsedSupplierExcel {
  siteInfo: SupplierSiteInfo;
  rows: SupplierResponseRow[];
  tabsFound: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cellText(cell: import("exceljs").Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in v) {
    return (v as import("exceljs").CellRichTextValue).richText.map((r) => r.text).join("");
  }
  if (typeof v === "object" && "result" in v) {
    return String((v as import("exceljs").CellFormulaValue).result ?? "");
  }
  return String(v).trim();
}

/** Returns true if the cell has a yellow/amber background fill */
function isHighlighted(cell: import("exceljs").Cell): boolean {
  const fill = cell.fill;
  if (!fill || fill.type !== "pattern") return false;
  const fg = (fill as import("exceljs").FillPattern).fgColor;
  if (!fg) return false;
  const argb = (fg.argb ?? "").toUpperCase();
  // Match yellow family: FFFFFF00, FFFFCC00, FFFFE066, FFFFD700, etc.
  if (argb.startsWith("FFFF") || argb.startsWith("FFFFD") || argb.startsWith("FFFFE")) return true;
  // Fallback: if no argb but has theme index, skip (can't determine colour)
  if (fg.theme !== undefined) return false;
  const hex = argb.slice(2);
  return hex.startsWith("FF") || hex.startsWith("FD") || hex.startsWith("FC");
}

/** Normalises Y/N/NA/empty from the raw cell text */
function parseAnswer(cVal: string, dVal: string): SupplierResponseRow["answer"] {
  const c = cVal.trim().toUpperCase();
  const d = dVal.trim().toUpperCase();
  if (d === "X" || d === "Y" || d === "NA" || d === "N/A" || (d !== "" && c === "")) return "N/A";
  if (c === "Y" || c === "X" || c === "YES") return "Y";
  if (c === "N" || c === "NO") return "N";
  if (c !== "") return "Y"; // any non-empty answer in col C treated as Y
  return "";
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export async function parseSupplierExcel(file: File): Promise<ParsedSupplierExcel> {
  const buffer = await file.arrayBuffer();
  const wb = new Workbook();
  await wb.xlsx.load(buffer);

  const siteInfo: SupplierSiteInfo = {};
  const rows: SupplierResponseRow[] = [];
  const tabsFound: string[] = [];

  for (const ws of wb.worksheets) {
    const name = ws.name.trim();

    // ── S1 Site Information ──────────────────────────────────────────────
    if (name.toLowerCase().startsWith("s1")) {
      ws.eachRow((row) => {
        const label = cellText(row.getCell(2)).replace(/:$/, "").trim();
        const value = cellText(row.getCell(3)).trim();
        if (label && value) siteInfo[label] = value;
      });
      tabsFound.push(name);
      continue;
    }

    // ── Skip Doc History and any non-section tabs ────────────────────────
    if (
      name.toLowerCase().startsWith("doc") ||
      name.toLowerCase().includes("history") ||
      name.toLowerCase().includes("cover") ||
      name.toLowerCase().includes("index")
    ) {
      continue;
    }

    // ── Section tabs (S2, S3, … S14, etc.) ──────────────────────────────
    if (!/^S\d/i.test(name)) continue;

    tabsFound.push(name);

    // Derive section label — try row 3 col A for the section code, then use tab name
    let sectionLabel = name;
    const headerRow = ws.getRow(3);
    const sectionCode = cellText(headerRow.getCell(1)).trim();
    const sectionTitle = cellText(headerRow.getCell(2)).trim();
    if (sectionCode && sectionTitle) {
      sectionLabel = `${sectionCode} — ${sectionTitle}`;
    } else if (sectionTitle) {
      sectionLabel = sectionTitle;
    }

    // Check if entire tab is marked N/A (e.g. "This tab is Not Applicable …")
    let tabNA = false;
    ws.eachRow({ includeEmpty: false }, (row, rn) => {
      if (rn <= 4) {
        const txt = cellText(row.getCell(2)).toLowerCase() + cellText(row.getCell(3)).toLowerCase();
        if (txt.includes("not applicable")) tabNA = true;
      }
    });

    // Data rows start at row 5 — col A has the question number (numeric or empty)
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber < 5) return;
      const qNo = cellText(row.getCell(1)).trim();
      const qText = cellText(row.getCell(2)).trim();
      // Skip rows that are not question data (no question text, or text is a sub-header)
      if (!qText || !qNo || isNaN(Number(qNo))) return;

      const cVal = cellText(row.getCell(3));
      const dVal = cellText(row.getCell(4));
      const comment = cellText(row.getCell(5)).trim();
      const answer = tabNA ? "N/A" : parseAnswer(cVal, dVal);
      const highlighted = isHighlighted(row.getCell(1)) ||
                          isHighlighted(row.getCell(2)) ||
                          isHighlighted(row.getCell(3)) ||
                          isHighlighted(row.getCell(5));

      rows.push({ section: sectionLabel, questionNo: qNo, questionText: qText, answer, comment, highlighted });
    });
  }

  return { siteInfo, rows, tabsFound };
}
