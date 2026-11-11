export function parseCSV(text) {
  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && inQuotes && text[i + 1] === '"') { current += '"'; i++; }
    else if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { row.push(current); current = ''; }
    else if (char === '\n' && !inQuotes) { row.push(current); rows.push(row); row = []; current = ''; }
    else if (char !== '\r') current += char;
  }
  if (inQuotes) throw new Error('El CSV contiene un campo sin cerrar.');
  if (current !== '' || row.length > 0) { row.push(current); rows.push(row); }
  return rows;
}
