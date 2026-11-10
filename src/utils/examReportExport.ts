/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import ExcelJS from 'exceljs';
import type { Exam, ExamSession, User } from '../types';

export interface QuestionAnswerAudit {
  index: number;
  questionId: string;
  questionText: string;
  selectedLetter: string;
  selectedText: string;
  correctLetter: string;
  correctText: string;
  isCorrect: boolean | null; // null if unanswered
}

export interface StudentExamReportRow {
  student: User;
  session?: ExamSession;
  variant?: number;
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  grade: number | null;
  passed: boolean;
  questionDetails: QuestionAnswerAudit[];
}

interface ExportExamExcelParams {
  exam: Exam;
  subjectName: string;
  groupLabel: string;
  rows: StudentExamReportRow[];
}

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
};

function formatDuration(seconds: number): string {
  const m = Math.floor((seconds || 0) / 60);
  const s = (seconds || 0) % 60;
  return `${m} daq ${s} son`;
}

function getGradeColors(grade: number | null): { bg: string; fg: string } {
  if (grade === 5) return { bg: 'FFDCFCE7', fg: 'FF15803D' };
  if (grade === 4) return { bg: 'FFDBEAFE', fg: 'FF1D4ED8' };
  if (grade === 3) return { bg: 'FFFEF3C7', fg: 'FFB45309' };
  if (grade === 2) return { bg: 'FFFEE2E2', fg: 'FFB91C1C' };
  return { bg: 'FFF1F5F9', fg: 'FF64748B' };
}

function getStatusLabel(session?: ExamSession): string {
  if (!session) return 'Topshirmagan';
  if (session.status === 'in_progress') return 'Jarayonda';
  if (session.status === 'terminated') return 'Chetlatildi';
  return session.passed ? "O'tdi" : 'Yiqildi';
}

function sanitizeFilePart(value: string): string {
  return value
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export async function exportExamReportToExcel({
  exam,
  subjectName,
  groupLabel,
  rows,
}: ExportExamExcelParams): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EduExam Secure';
  workbook.created = new Date();

  const finishedRows = rows.filter((r) => r.session && r.session.status !== 'in_progress');
  const passedCount = finishedRows.filter((r) => r.passed).length;
  const avgPct = finishedRows.length
    ? Math.round(finishedRows.reduce((acc, r) => acc + r.percentage, 0) / finishedRows.length)
    : 0;
  const gradeCounts = [5, 4, 3, 2].map((g) => ({
    grade: g,
    count: finishedRows.filter((r) => r.grade === g).length,
  }));

  // =========================================================================
  // SHEET 1: UMUMIY NATIJALAR
  // =========================================================================
  const summarySheet = workbook.addWorksheet('Umumiy Natijalar', {
    views: [{ state: 'frozen', ySplit: 6 }],
  });

  summarySheet.mergeCells('A1:L1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = `NAZORAT ISHI NATIJALARI HISOBOTI — ${exam.title.toUpperCase()}`;
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  summarySheet.getRow(1).height = 32;

  summarySheet.mergeCells('A2:F2');
  summarySheet.getCell('A2').value = `Fan: ${subjectName}   |   Guruh: ${groupLabel}`;
  summarySheet.getCell('A2').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };

  summarySheet.mergeCells('G2:L2');
  summarySheet.getCell('G2').value = `Sana: ${new Date().toLocaleDateString('uz-UZ')}   |   O'tish bali: ${exam.passingScore}%`;
  summarySheet.getCell('G2').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  summarySheet.getCell('G2').alignment = { horizontal: 'right' };
  summarySheet.getRow(2).height = 22;

  summarySheet.mergeCells('A3:F3');
  summarySheet.getCell('A3').value = `Jami o'quvchilar: ${rows.length} ta   |   Topshirdi: ${finishedRows.length} ta   |   O'tdi: ${passedCount} ta   |   O'rtacha: ${avgPct}%`;
  summarySheet.getCell('A3').font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };

  summarySheet.mergeCells('G3:L3');
  summarySheet.getCell('G3').value = `Baholar: ${gradeCounts
    .map((g) => `${g.grade} baho — ${g.count} ta`)
    .join('   •   ')}`;
  summarySheet.getCell('G3').font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF4338CA' } };
  summarySheet.getCell('G3').alignment = { horizontal: 'right' };
  summarySheet.getRow(3).height = 20;

  for (let r = 2; r <= 3; r++) {
    for (let c = 1; c <= 12; c++) {
      summarySheet.getRow(r).getCell(c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEEF2FF' },
      };
    }
  }

  summarySheet.getRow(4).height = 8;

  const summaryHeaders = [
    '№',
    "O'quvchi F.I.O",
    'Talaba ID',
    'Guruh',
    'Variant',
    "To'g'ri javoblar",
    'Ball',
    'Foiz (%)',
    'Baho',
    'Holat',
    'Anti-Cheat',
    'Sarflangan vaqt',
  ];

  // Put headers on row 6 so frozen ySplit: 6 freezes cleanly
  summarySheet.getRow(5).height = 6;
  const headerRow = summarySheet.getRow(6);
  headerRow.values = summaryHeaders;
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = BORDER_THIN;
  });

  rows.forEach((row, idx) => {
    const sess = row.session;
    const isFinished = Boolean(sess && sess.status !== 'in_progress');
    const statusLabel = getStatusLabel(sess);
    const gradeColors = getGradeColors(isFinished ? row.grade : null);

    const excelRow = summarySheet.addRow([
      idx + 1,
      row.student.fullName,
      row.student.studentId || row.student.id,
      row.student.groupName || sess?.groupName || '—',
      row.variant ? `${row.variant}-variant` : '—',
      isFinished && row.totalQuestions > 0 ? `${row.correctCount} / ${row.totalQuestions}` : '—',
      isFinished && sess ? `${sess.score} / ${sess.totalScore}` : '—',
      isFinished ? `${row.percentage}%` : '—',
      isFinished && row.grade !== null ? row.grade : '—',
      statusLabel,
      sess ? `${sess.violationsCount} / 3` : '—',
      sess ? formatDuration(sess.timeSpentSeconds) : '—',
    ]);
    excelRow.height = 22;
    const zebraFill = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';

    excelRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebraFill } };
      cell.border = BORDER_THIN;
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 2 ? 'left' : 'center',
      };
    });

    // Grade badge cell
    const gradeCell = excelRow.getCell(9);
    gradeCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: gradeColors.fg } };
    gradeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: gradeColors.bg } };

    // Status cell
    const statusCell = excelRow.getCell(10);
    if (statusLabel === "O'tdi") {
      statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF15803D' } };
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
    } else if (statusLabel === 'Yiqildi' || statusLabel === 'Chetlatildi') {
      statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
    } else {
      statusCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
    }
  });

  summarySheet.columns = [
    { width: 6 },
    { width: 28 },
    { width: 17 },
    { width: 12 },
    { width: 12 },
    { width: 17 },
    { width: 13 },
    { width: 11 },
    { width: 9 },
    { width: 14 },
    { width: 13 },
    { width: 17 },
  ];

  // =========================================================================
  // SHEET 2: SAVOL-JAVOB MATRITSASI
  // =========================================================================
  const maxQCount = rows.reduce((max, r) => Math.max(max, r.questionDetails.length), 0);
  if (maxQCount > 0) {
    const matrixSheet = workbook.addWorksheet('Savol Matritsasi', {
      views: [{ state: 'frozen', xSplit: 5, ySplit: 2 }],
    });

    const totalCols = 5 + maxQCount;
    matrixSheet.mergeCells(1, 1, 1, totalCols);
    const mTitle = matrixSheet.getCell(1, 1);
    mTitle.value = `${exam.title} — Savollar kesimida javoblar matritsasi (${groupLabel})`;
    mTitle.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    mTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
    mTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    matrixSheet.getRow(1).height = 28;

    const matrixHeaders = [
      '№',
      "O'quvchi F.I.O",
      'Variant',
      "To'g'ri / Jami",
      'Baho',
      ...Array.from({ length: maxQCount }, (_, i) => `${i + 1}-savol`),
    ];
    const mHeaderRow = matrixSheet.getRow(2);
    mHeaderRow.values = matrixHeaders;
    mHeaderRow.height = 24;
    mHeaderRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = BORDER_THIN;
    });

    rows.forEach((row, idx) => {
      const isFinished = Boolean(row.session && row.session.status !== 'in_progress');
      const values: (string | number)[] = [
        idx + 1,
        row.student.fullName,
        row.variant ? `V-${row.variant}` : '—',
        isFinished && row.totalQuestions > 0 ? `${row.correctCount}/${row.totalQuestions}` : '—',
        isFinished && row.grade !== null ? row.grade : '—',
      ];

      for (let qIdx = 0; qIdx < maxQCount; qIdx++) {
        const qAudit = row.questionDetails[qIdx];
        if (!qAudit || !row.session) {
          values.push('—');
        } else if (qAudit.isCorrect === true) {
          values.push(`✓ (${qAudit.selectedLetter})`);
        } else if (qAudit.isCorrect === false) {
          values.push(`✗ (${qAudit.selectedLetter}→${qAudit.correctLetter})`);
        } else {
          values.push(`— (→${qAudit.correctLetter})`);
        }
      }

      const mRow = matrixSheet.addRow(values);
      mRow.height = 20;
      mRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF0F172A' } };
        cell.border = BORDER_THIN;
        cell.alignment = { vertical: 'middle', horizontal: colNumber === 2 ? 'left' : 'center' };

        if (colNumber === 5 && isFinished) {
          const gc = getGradeColors(row.grade);
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: gc.fg } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: gc.bg } };
        }

        if (colNumber > 5) {
          const qAudit = row.questionDetails[colNumber - 6];
          if (qAudit && row.session) {
            if (qAudit.isCorrect === true) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
              cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF15803D' } };
            } else if (qAudit.isCorrect === false) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
              cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFB91C1C' } };
            } else {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
              cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF64748B' } };
            }
          }
        }
      });
    });

    matrixSheet.columns = [
      { width: 5 },
      { width: 26 },
      { width: 9 },
      { width: 12 },
      { width: 8 },
      ...Array.from({ length: maxQCount }, () => ({ width: 11 })),
    ];
  }

  // =========================================================================
  // SHEET 3: BATAFSIL SAVOL TAHLILI
  // =========================================================================
  const detailSheet = workbook.addWorksheet('Batafsil Savol Tahlili', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  detailSheet.mergeCells('A1:I1');
  const dTitle = detailSheet.getCell('A1');
  dTitle.value = `${exam.title} — Har bir o'quvchining savollar bo'yicha javoblari (${groupLabel})`;
  dTitle.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  dTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
  dTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  detailSheet.getRow(1).height = 28;

  const dHeader = detailSheet.getRow(2);
  dHeader.values = [
    "O'quvchi F.I.O",
    'Talaba ID',
    'Guruh',
    'Variant',
    'Savol №',
    'Savol matni',
    'Tanlangan javob',
    "To'g'ri javob",
    'Holat',
  ];
  dHeader.height = 24;
  dHeader.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDER_THIN;
  });

  rows.forEach((row) => {
    if (!row.session || row.questionDetails.length === 0) return;
    row.questionDetails.forEach((q) => {
      const statusText =
        q.isCorrect === true ? "To'g'ri" : q.isCorrect === false ? "Noto'g'ri" : 'Belgilanmagan';
      const dRow = detailSheet.addRow([
        row.student.fullName,
        row.student.studentId || row.student.id,
        row.student.groupName || row.session?.groupName || '—',
        row.variant ? `${row.variant}-variant` : '—',
        q.index,
        q.questionText,
        q.selectedLetter ? `${q.selectedLetter}) ${q.selectedText}` : 'Belgilanmagan',
        `${q.correctLetter}) ${q.correctText}`,
        statusText,
      ]);
      dRow.height = 22;
      dRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF0F172A' } };
        cell.border = BORDER_THIN;
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 5 || colNumber === 9 || colNumber === 4 ? 'center' : 'left',
          wrapText: colNumber >= 6 && colNumber <= 8,
        };
      });

      const statusCell = dRow.getCell(9);
      if (q.isCorrect === true) {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        statusCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF15803D' } };
      } else if (q.isCorrect === false) {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        statusCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFB91C1C' } };
      } else {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        statusCell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF64748B' } };
      }
    });
  });

  detailSheet.columns = [
    { width: 25 },
    { width: 16 },
    { width: 11 },
    { width: 11 },
    { width: 9 },
    { width: 45 },
    { width: 32 },
    { width: 32 },
    { width: 15 },
  ];

  // Trigger download via Blob
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const fileName = `${sanitizeFilePart(subjectName)}_${sanitizeFilePart(exam.title)}_${sanitizeFilePart(groupLabel)}_natijalar.xlsx`;
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

interface ExportSingleStudentExcelParams {
  exam: Exam;
  subjectName: string;
  row: StudentExamReportRow;
}

export async function exportSingleStudentReportToExcel({
  exam,
  subjectName,
  row,
}: ExportSingleStudentExcelParams): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EduExam Secure';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Shaxsiy Natija', {
    views: [{ state: 'frozen', ySplit: 6 }],
  });

  const sess = row.session;
  const isFinished = Boolean(sess && sess.status !== 'in_progress');
  const statusLabel = getStatusLabel(sess);
  const gradeColors = getGradeColors(isFinished ? row.grade : null);
  const groupName = row.student.groupName || sess?.groupName || '—';

  // Row 1: Title Banner
  sheet.mergeCells('A1:F1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `SHAXSIY NAZORAT NATIJASI — ${row.student.fullName.toUpperCase()}`;
  titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 30;

  // Row 2: Subject & Exam Info
  sheet.mergeCells('A2:D2');
  sheet.getCell('A2').value = `Fan: ${subjectName}   |   Nazorat: ${exam.title}`;
  sheet.getCell('A2').font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF1E293B' } };
  sheet.mergeCells('E2:F2');
  sheet.getCell('E2').value = `Sana: ${
    sess?.submittedAt
      ? new Date(sess.submittedAt).toLocaleDateString('uz-UZ')
      : new Date().toLocaleDateString('uz-UZ')
  }`;
  sheet.getCell('E2').font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF1E293B' } };
  sheet.getCell('E2').alignment = { horizontal: 'right' };
  sheet.getRow(2).height = 22;

  // Row 3: Student Details
  sheet.mergeCells('A3:D3');
  sheet.getCell('A3').value = `Talaba ID: ${row.student.studentId || row.student.id}   |   Guruh: ${groupName}   |   Variant: ${
    row.variant ? `${row.variant}-variant` : 'Umumiy'
  }`;
  sheet.getCell('A3').font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
  sheet.mergeCells('E3:F3');
  sheet.getCell('E3').value = `Vaqt: ${sess ? formatDuration(sess.timeSpentSeconds) : '—'}   |   Anti-Cheat: ${
    sess ? `${sess.violationsCount} / 3` : '—'
  }`;
  sheet.getCell('E3').font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
  sheet.getCell('E3').alignment = { horizontal: 'right' };
  sheet.getRow(3).height = 20;

  for (let r = 2; r <= 3; r++) {
    for (let c = 1; c <= 6; c++) {
      sheet.getRow(r).getCell(c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEEF2FF' },
      };
    }
  }

  // Row 4: Summary Metrics Strip
  const summaryRow = sheet.getRow(4);
  summaryRow.values = [
    'Natija:',
    row.totalQuestions > 0
      ? `To'g'ri javoblar: ${row.correctCount} / ${row.totalQuestions} ta`
      : `Ball: ${sess ? `${sess.score} / ${sess.totalScore}` : '—'}`,
    `Ball: ${sess ? `${sess.score} / ${sess.totalScore}` : '—'}`,
    `Foiz: ${isFinished ? `${row.percentage}%` : '—'}`,
    isFinished && row.grade !== null ? `${row.grade} baho` : '—',
    statusLabel,
  ];
  summaryRow.height = 24;
  summaryRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    cell.border = BORDER_THIN;
    cell.alignment = { vertical: 'middle', horizontal: colNumber <= 2 ? 'left' : 'center' };
  });

  const sGradeCell = summaryRow.getCell(5);
  sGradeCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: gradeColors.fg } };
  sGradeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: gradeColors.bg } };

  const sStatusCell = summaryRow.getCell(6);
  if (statusLabel === "O'tdi") {
    sStatusCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF15803D' } };
    sStatusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
  } else if (statusLabel === 'Yiqildi' || statusLabel === 'Chetlatildi') {
    sStatusCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFB91C1C' } };
    sStatusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
  }

  sheet.getRow(5).height = 8;

  // Row 6: Question-by-question Table Header
  const headerRow = sheet.getRow(6);
  headerRow.values = [
    '№',
    'Savol matni',
    "O'quvchi tanlagan javob",
    "To'g'ri javob",
    'Holat',
    'Natija',
  ];
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = BORDER_THIN;
  });

  // Rows 7+: Questions
  row.questionDetails.forEach((qd, idx) => {
    const selectedDisplay = qd.selectedLetter
      ? `${qd.selectedLetter}) ${qd.selectedText}`
      : 'Belgilanmagan';
    const correctDisplay = `${qd.correctLetter}) ${qd.correctText}`;
    const qStatus =
      qd.isCorrect === true
        ? "To'g'ri"
        : qd.isCorrect === false
        ? "Noto'g'ri"
        : 'Belgilanmagan';
    const mark = qd.isCorrect === true ? '✓ (+1)' : qd.isCorrect === false ? '✗ (0)' : '—';

    const qRow = sheet.addRow([
      qd.index,
      qd.questionText,
      selectedDisplay,
      correctDisplay,
      qStatus,
      mark,
    ]);

    const maxLines = Math.max(
      Math.ceil(qd.questionText.length / 44),
      Math.ceil(selectedDisplay.length / 30),
      Math.ceil(correctDisplay.length / 30),
      1
    );
    qRow.height = Math.max(22, maxLines * 15);
    const zebraFill = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';

    qRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebraFill } };
      cell.border = BORDER_THIN;
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 1 || colNumber >= 5 ? 'center' : 'left',
        wrapText: colNumber >= 2 && colNumber <= 4,
      };
    });

    const statusCell = qRow.getCell(5);
    const markCell = qRow.getCell(6);
    if (qd.isCorrect === true) {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF15803D' } };
      markCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      markCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF15803D' } };
    } else if (qd.isCorrect === false) {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
      markCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      markCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
      qRow.getCell(3).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
    } else {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      statusCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
    }
  });

  // Footer total row
  const wrongCount = Math.max(0, row.totalQuestions - row.correctCount);
  const footerRow = sheet.addRow([
    'JAMI',
    `${row.totalQuestions} ta savol`,
    `To'g'ri: ${row.correctCount} ta   |   Noto'g'ri: ${wrongCount} ta`,
    `Foiz: ${isFinished ? `${row.percentage}%` : '—'}`,
    isFinished && row.grade !== null ? `${row.grade} baho` : '—',
    statusLabel,
  ]);
  footerRow.height = 24;
  footerRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = BORDER_THIN;
    cell.alignment = { vertical: 'middle', horizontal: colNumber >= 4 || colNumber === 1 ? 'center' : 'left' };
  });

  sheet.columns = [
    { width: 7 },
    { width: 48 },
    { width: 34 },
    { width: 34 },
    { width: 16 },
    { width: 14 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const fileName = `${sanitizeFilePart(row.student.fullName)}_${sanitizeFilePart(exam.title)}_natija.xlsx`;
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
