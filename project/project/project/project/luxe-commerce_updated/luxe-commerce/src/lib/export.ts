/* Export utilities for reports — CSV, Excel-compatible, and print support */

export interface ExportColumn {
  key: string;
  label: string;
  format?: (value: unknown, row: Record<string, unknown>) => string;
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function exportToCsv(filename: string, columns: ExportColumn[], rows: Record<string, unknown>[]): void {
  const header = columns.map((c) => escapeCsv(c.label)).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const raw = row[c.key];
          const val = c.format ? c.format(raw, row) : String(raw ?? '');
          return escapeCsv(val);
        })
        .join(','),
    )
    .join('\n');
  const csv = `${header}\n${body}`;
  downloadFile(`${filename}.csv`, csv, 'text/csv;charset=utf-8;');
}

export function exportToExcel(filename: string, columns: ExportColumn[], rows: Record<string, unknown>[]): void {
  const header = columns.map((c) => `<th style="background:#1a1a2e;color:#fbbf24;padding:8px;border:1px solid #333;">${c.label}</th>`).join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((c) => {
            const raw = row[c.key];
            const val = c.format ? c.format(raw, row) : String(raw ?? '');
            return `<td style="padding:6px 8px;border:1px solid #ddd;color:#222;">${escapeHtml(val)}</td>`;
          })
          .join('')}</tr>`,
    )
    .join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table style="border-collapse:collapse;font-family:sans-serif;font-size:12px;"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  downloadFile(`${filename}.xls`, html, 'application/vnd.ms-excel');
}

export function exportToPdf(filename: string, title: string, columns: ExportColumn[], rows: Record<string, unknown>[]): void {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;
  const header = columns.map((c) => `<th style="text-align:left;padding:8px 12px;border-bottom:2px solid #1a1a2e;color:#1a1a2e;font-size:12px;text-transform:uppercase;">${escapeHtml(c.label)}</th>`).join('');
  const body = rows
    .map(
      (row, i) =>
        `<tr style="${i % 2 ? 'background:#f9fafb;' : ''}">${columns
          .map((c) => {
            const raw = row[c.key];
            const val = c.format ? c.format(raw, row) : String(raw ?? '');
            return `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color #374151;font-size:13px;">${escapeHtml(val)}</td>`;
          })
          .join('')}</tr>`,
    )
    .join('');
  printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,system-ui,sans-serif;padding:32px;color:#1f2937}h1{font-size:24px;margin-bottom:4px}p{color:#6b7280;margin-bottom:24px;font-size:14px}table{width:100%;border-collapse:collapse}</style></head><body><h1>${title}</h1><p>Generated ${new Date().toLocaleString()}</p><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table><script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script></body></html>`);
  printWindow.document.close();
}

function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
