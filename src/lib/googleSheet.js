const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSPFczRsVCy62h525IVkhjiYLSn_PPoxB0xj5dQZOL5ybjvHaP3x7WDbUQvvGPPvdi1aX47YJ8rEywQ/pub?output=csv'

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

// Find the next (non-completed) schedule row for a player by searching their name in standings.
// standings: { basic: [...], expert: [...] } from fetchStandings()
// schedule: rows from fetchSchedule()
export function findScheduleRowByName(name, standings, schedule) {
  if (!name) return null
  const needle = name.toLowerCase().trim()

  const allMatches = [...(standings.basic || []), ...(standings.expert || [])]

  // Prefer upcoming matches first, then any match with a court
  const priority = (m) => (m.completed ? 1 : 0)

  const standingMatch = allMatches
    .filter(m =>
      [...m.team1.players, ...m.team2.players].some(p =>
        p.toLowerCase().trim() === needle
      )
    )
    .sort((a, b) => priority(a) - priority(b))[0]

  if (!standingMatch) return null

  return schedule.find(r => r.matchNo === standingMatch.matchNo) ?? null
}

// Build a player's full court picture by matching their name (from the
// attendees `name` column) against the standings sheets, then joining each
// match to the schedule sheet for its live/upcoming/done status.
// Returns: { matches, live, next, allDone } or null when the name isn't found.
//   matches  — every match the player is in, sorted by match number
//   live     — the match they're playing right now (status 'live'), or null
//   next     — the next match they still need to go to (status 'upcoming'), or null
//   allDone  — true when every match of theirs is finished
export function findPlayerCourtInfo(name, standings, schedule) {
  if (!name) return null
  const needle = name.toLowerCase().trim()
  const allMatches = [...(standings.basic || []), ...(standings.expert || [])]

  const matches = allMatches
    .filter(m =>
      [...m.team1.players, ...m.team2.players].some(p => p.toLowerCase().trim() === needle)
    )
    .map(m => {
      const sched = schedule.find(r => r.matchNo === m.matchNo)
      const courtNum = sched?.courtNum ?? (parseInt(String(m.court).replace(/[^\d]/g, '')) || null)
      const courtRaw = sched?.courtRaw || m.court || (courtNum ? `Court ${courtNum}` : '')
      const status = sched?.status || (m.completed ? 'done' : 'upcoming')
      const inTeam1 = m.team1.players.some(p => p.toLowerCase().trim() === needle)
      const opp = inTeam1 ? m.team2 : m.team1
      return {
        matchNo: m.matchNo,
        round: m.round || sched?.round || '',
        level: m.level,
        time: m.time || sched?.time || '',
        status,
        completed: m.completed,
        courtNum,
        courtRaw,
        opponent: opp.team || opp.players.join(' / ') || '',
      }
    })
    .sort((a, b) => a.matchNo - b.matchNo)

  if (matches.length === 0) return null

  const live = matches.find(m => m.status === 'live') || null
  const next = matches.find(m => m.status === 'upcoming') || null
  const allDone = matches.every(m => m.status === 'done' || m.completed)

  return { matches, live, next, allDone }
}

// ─── Standings from detailed bracket sheets ───────────────────────────────

const GID_BASIC  = '2007438050'
const GID_EXPERT = '1017201964'

async function fetchSheetText(gid) {
  const res = await fetch(`${CSV_URL}&gid=${gid}`)
  return res.text()
}

function parseStandingsSheet(text, level) {
  const rows = text.split('\n').map(parseCsvRow)
  const matches = []
  let currentRound = ''
  let pending = null   // team-1 row waiting for its team-2 pair

  for (const row of rows) {
    const c = (i) => (row[i] || '').trim()
    const matchNo = parseInt(c(2))

    // Section-header row: col[0] has Thai text, col[2] is empty, skip "Time" rows
    if (c(0) && !c(2) && c(0) !== 'Time' && isNaN(parseInt(c(0)))) {
      if (c(0).includes('รอบ') || c(0).includes('ตาราง')) {
        currentRound = c(0).replace(/\s+/g, ' ').trim()
      }
      pending = null
      continue
    }

    // Team-1 row: col[2] is a valid match number
    if (!isNaN(matchNo) && matchNo > 0) {
      pending = {
        matchNo,
        time: c(0),
        round: currentRound,
        level,
        court: c(11),
        team: c(5),
        players: [c(6), c(7)].filter(Boolean),
        s: [c(8), c(9), c(10)].map(Number),
      }
      continue
    }

    // Team-2 row: col[2] empty, col[4] non-empty, follows a team-1 row
    if (!c(2) && c(4) && pending) {
      const t2 = {
        team: c(5),
        players: [c(6), c(7)].filter(Boolean),
        s: [c(8), c(9), c(10)].map(Number),
      }

      // Only keep matches where at least one team has a name
      if (pending.team || t2.team) {
        const t1wins = pending.s.filter((v, i) => v > 0 && v > t2.s[i]).length
        const t2wins = t2.s.filter((v, i) => v > 0 && v > pending.s[i]).length
        const completed = pending.s.some(v => v > 0) || t2.s.some(v => v > 0)
        const winner = t1wins >= 2 ? (pending.team || 'Team 1')
                     : t2wins >= 2 ? (t2.team || 'Team 2')
                     : null

        matches.push({
          matchNo: pending.matchNo,
          time: pending.time,
          round: pending.round,
          level,
          court: pending.court,
          team1: { team: pending.team, players: pending.players, scores: pending.s },
          team2: { team: t2.team, players: t2.players, scores: t2.s },
          winner,
          completed,
        })
      }
      pending = null
    }
  }

  return matches
}

export async function fetchStandings() {
  const [basicText, expertText] = await Promise.all([
    fetchSheetText(GID_BASIC),
    fetchSheetText(GID_EXPERT),
  ])
  return {
    basic:  parseStandingsSheet(basicText,  'Basic Level'),
    expert: parseStandingsSheet(expertText, 'Expert Level'),
  }
}
