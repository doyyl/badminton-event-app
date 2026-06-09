const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQT8mLCtvDk-6szfIHyYjgruTLcdH-ZT3kXWDrQbqpzEkNfu-jVoVGVbxNkh7xHUaNO-boy6-iVlgqP/pub?output=csv'

function parseCsvRow(line) {
  const cells = []
  let inQuote = false
  let cell = ''
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote }
    else if (ch === ',' && !inQuote) { cells.push(cell.trim()); cell = '' }
    else { cell += ch }
  }
  cells.push(cell.trim())
  return cells
}

export async function fetchSchedule() {
  const res = await fetch(CSV_URL)
  const text = await res.text()
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const headers = parseCsvRow(lines[1])

  return lines.slice(2)
    .map(line => {
      const cells = parseCsvRow(line)
      const raw = {}
      headers.forEach((h, i) => { raw[h] = cells[i] || '' })
      return raw
    })
    .filter(r => r['Match'] && !isNaN(parseInt(r['Match'])))
    .map(r => ({
      matchNo: parseInt(r['Match']),
      round: r['รอบ'] || '',
      category: r['รุ่น'] || '',
      time: r['เวลา'] || '',
      statusRaw: r['สถานะ'] || '',
      status: r['สถานะ'] === 'กำลังแข่งขัน' ? 'live'
             : r['สถานะ'] === 'แข่งขันจบ' ? 'done'
             : 'upcoming',
      courtRaw: r['สนาม'] || '',
      courtNum: parseInt((r['สนาม'] || '').replace('สนาม', '')) || null,
      _raw: r,
    }))
}

// Search all cell values for an email match — works when organizer adds email columns to the sheet
export function findRowByEmail(rows, email) {
  if (!email) return null
  const needle = email.toLowerCase().trim()
  return rows.find(r =>
    Object.values(r._raw).some(v => v.toLowerCase().trim() === needle)
  ) ?? null
}
