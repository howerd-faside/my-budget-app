/**
 * CSV export utility — generates a CSV file and triggers a browser download.
 *
 * @param {string} filename - Download filename (should end in .csv)
 * @param {string[]} headers - Column header row
 * @param {(string|number)[][]} rows - Data rows (same length as headers)
 */
export function exportCSV(filename, headers, rows) {
  const escape = (val) => {
    const s = String(val ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const lines = [
    headers.map(escape).join(','),
    ...rows.map(row => row.map(escape).join(',')),
  ];

  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
