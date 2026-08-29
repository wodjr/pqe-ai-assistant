/**
 * lib/parseExcel.ts — PQE AI Assistant
 *
 * Parses an uploaded .xlsx workbook into a ChecklistTemplate.
 *
 * Rules:
 * - The original workbook Blob is stored READ-ONLY in IndexedDB.
 * - No data is written back to the workbook at any point.
 * - ExcelJS runs client-side via its browser-compatible ESM build.
 *
 * Expected workbook conventions (flexible — falls back gracefully):
 *   Column A  — Question reference (e.g. "4.1.2") or section heading
 *   Column B  — Question text / description
 *   Column C  — Guidance / notes (optional)
 *   Column D  — Max score (numeric, optional)
 *   Column E  — Scoring basis text (optional, e.g. "0 / 4 / 8 / 10")
 *   Column F  — Mandatory flag ("Y", "Yes", "1", or "TRUE" → true)
 *
 * A row is treated as a SECTION HEADING if:
 *   - Column A is empty AND Column B is non-empty, OR
 *   - The row has a bold/merged cell in column B, OR
 *   - Column A value looks like a top-level number only (e.g. "1", "2.")
 */

import { Workbook } from "exceljs";
import type { Cell, Row, Font, CellRichTextValue, CellFormulaValue } from "exceljs";
import { nanoid } from "@/lib/utils/nanoid";
import type { ChecklistTemplate, ChecklistSection, ChecklistQuestion } from "@/types/project";

function cellStr(cell: Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return v.toISOString();
  // RichText
  if (typeof v === "object" && "richText" in v) {
    return (v as CellRichTextValue).richText.map((r) => r.text).join("").trim();
  }
  // Formula result
  if (typeof v === "object" && "result" in v) {
    const result = (v as CellFormulaValue).result;
    return result !== null && result !== undefined ? String(result).trim() : "";
  }
  // SharedString / error
  return String(v).trim();
}

function cellNum(cell: Cell): number | null {
  const v = cell.value;
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function isSectionRow(refStr: string, textStr: string, row: Row): boolean {
  if (!refStr && textStr) return true;
  // Top-level single number, e.g. "1", "2.", "3"
  if (/^\d+\.?$/.test(refStr)) return true;
  // Bold cell in column B
  const cellB = row.getCell(2);
  const font = cellB.font as Font | undefined;
  if (font?.bold) return true;
  return false;
}

function isMandatory(cell: Cell): boolean {
  const s = cellStr(cell).toUpperCase();
  return s === "Y" || s === "YES" || s === "1" || s === "TRUE";
}

export async function parseExcelToChecklist(
  file: File,
  overrideName?: string
): Promise<{ template: ChecklistTemplate; blob: Blob }> {
  const arrayBuffer = await file.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: file.type });

  const workbook = new Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const templateId = nanoid();
  const blobKey = `checklist_blob_${templateId}`;
  const sections: ChecklistSection[] = [];

  let currentSection: ChecklistSection | null = null;
  let sectionOrder = 0;
  let questionOrder = 0;
  let totalMaxScore = 0;

  for (const worksheet of workbook.worksheets) {
    // Process each worksheet as a section group
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const refStr = cellStr(row.getCell(1));
      const textStr = cellStr(row.getCell(2));

      // Skip completely empty rows and header rows
      if (!refStr && !textStr) return;
      if (
        textStr.toLowerCase().includes("question") &&
        refStr.toLowerCase().includes("ref") &&
        row.number <= 3
      ) {
        return; // likely a header row
      }

      if (isSectionRow(refStr, textStr, row)) {
        currentSection = {
          id: nanoid(),
          title: textStr || refStr,
          order: sectionOrder++,
          questions: [],
        };
        sections.push(currentSection);
        return;
      }

      // Ensure we have a section to add questions to
      if (!currentSection) {
        currentSection = {
          id: nanoid(),
          title: worksheet.name || "General",
          order: sectionOrder++,
          questions: [],
        };
        sections.push(currentSection);
      }

      const guidanceStr = cellStr(row.getCell(3));
      const maxScore = cellNum(row.getCell(4));
      const scoringBasis = cellStr(row.getCell(5)) || null;
      const mandatory = isMandatory(row.getCell(6));

      if (maxScore !== null) totalMaxScore += maxScore;

      const question: ChecklistQuestion = {
        id: nanoid(),
        sectionId: currentSection.id,
        order: questionOrder++,
        reference: refStr,
        text: textStr,
        guidance: guidanceStr,
        maxScore,
        scoringBasis,
        isMandatory: mandatory,
      };

      currentSection.questions.push(question);
    });
  }

  // Filter out sections with no questions
  const validSections = sections.filter((s) => s.questions.length > 0);

  const revision = `R${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;

  const template: ChecklistTemplate = {
    id: templateId,
    name: overrideName || file.name.replace(/\.[^.]+$/, ""),
    revision,
    importedAt: new Date().toISOString(),
    sourceFileName: file.name,
    sourceFileBlobKey: blobKey,
    sections: validSections,
    totalMaxScore,
  };

  return { template, blob };
}
