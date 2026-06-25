import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchSchedule, fetchStandings } from '../lib/googleSheet'
import LoadingSpinner from '../components/LoadingSpinner'

const LEVELS = [
  { key: 'expert', label: 'Expert' },
  { key: 'basic', label: 'Beginner' },
]

// Column order, left → right: the knockout / play-in stage comes first, then
// the main rounds by largest field (32 → 16 → 8 …), then semifinal and final.
function roundRank(name) {
  if (/น้อก/.test(name)) return 0
  const n = name.match(/(\d+)\s*ทีม/)
  if (n) return 10000 - parseInt(n[1], 10)
  if (/รอง/.test(name)) return 25000
  if (/ชิง/.test(name)) return 30000
  return 20000
}

function roundLabel(name) {
  const n = name.match(/(\d+)\s*ทีม/)
  if (n) return `Round of ${n[1]}`
  if (/ชิง/.test(name)) return 'Final'
  if (/รอง/.test(name)) return 'Semifinal'
  if (/น้อก/.test(name)) return 'Knockout'
  return name
}

// Group a level's matches into round columns ordered left-to-right.
function buildColumns(matches) {
  const byRound = new Map()
  for (const m of matches) {
    const r = m.round || 'อื่นๆ'
    if (!byRound.has(r)) byRound.set(r, [])
    byRound.get(r).push(m)
  }
  return [...byRound.entries()]
    .map(([round, ms]) => ({ round, matches: ms }))
    .sort((a, b) => roundRank(a.round) - roundRank(b.round))
}

// The sheet doesn't say which match a winner advances to, but the winner's name
// reappears in a later-round match — so connect matches that share a player name
// across columns. Each player's progression draws one link per round it crosses.
function computeConnections(columns) {
  const nameToEntries = new Map()
  columns.forEach((col, ci) => {
    col.matches.forEach(m => {
      const names = [...m.team1.players, ...m.team2.players]
        .map(p => p.toLowerCase().trim())
        .filter(Boolean)
      for (const n of names) {
        if (!nameToEntries.has(n)) nameToEntries.set(n, [])
        nameToEntries.get(n).push({ matchNo: m.matchNo, col: ci })
      }
    })
  })

  const conns = new Set()
  for (const entries of nameToEntries.values()) {
    const sorted = entries.sort((a, b) => a.col - b.col)
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1]
      if (a.col !== b.col) conns.add(`${a.matchNo}->${b.matchNo}`)
    }
  }
  return [...conns].map(s => {
    const [from, to] = s.split('->').map(Number)
    return { from, to }
  })
}

export default function BracketPage() {
  const nav = useNavigate()
  const [standings, setStandings] = useState({ basic: [], expert: [] })
  const [statusByNo, setStatusByNo] = useState({})
  const [level, setLevel] = useState('expert')
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState(null)
  const timerRef = useRef(null)

  const boardRef = useRef(null)
  const cardRefs = useRef(new Map())
  const [lines, setLines] = useState([])
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 })

  async function load() {
    try {
      const [standing, schedule] = await Promise.all([fetchStandings(), fetchSchedule()])
      setStandings(standing)
      setStatusByNo(Object.fromEntries(schedule.map(r => [r.matchNo, r.status])))
      setUpdatedAt(new Date())
    } catch {
      // sheet hiccups are non-fatal — keep showing the last good board
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, 30_000)
    return () => clearInterval(timerRef.current)
  }, [])

  const { columns, connections } = useMemo(() => {
    const cols = buildColumns(standings[level] || [])
    return { columns: cols, connections: computeConnections(cols) }
  }, [standings, level])

  const liveCount = (standings[level] || []).filter(m => statusByNo[m.matchNo] === 'live').length

  // Measure card positions and turn each connection into an SVG curve.
  const recompute = useCallback(() => {
    const board = boardRef.current
    if (!board) return
    const bRect = board.getBoundingClientRect()
    const next = []
    for (const { from, to } of connections) {
      const a = cardRefs.current.get(from)
      const b = cardRefs.current.get(to)
      if (!a || !b) continue
      const ar = a.getBoundingClientRect()
      const br = b.getBoundingClientRect()
      next.push({
        x1: ar.right - bRect.left,
        y1: ar.top + ar.height / 2 - bRect.top,
        x2: br.left - bRect.left,
        y2: br.top + br.height / 2 - bRect.top,
      })
    }
    setLines(next)
    setSvgSize({ w: board.scrollWidth, h: board.scrollHeight })
  }, [connections])

  useLayoutEffect(() => {
    recompute()
    const id = requestAnimationFrame(recompute) // re-measure once layout/fonts settle
    return () => cancelAnimationFrame(id)
  }, [recompute, columns])

  useEffect(() => {
    const onResize = () => recompute()
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(() => recompute())
    if (boardRef.current) ro.observe(boardRef.current)
    return () => {
      window.removeEventListener('resize', onResize)
      ro.disconnect()
    }
  }, [recompute])

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center gap-4 sticky top-0 z-20">
        <button onClick={() => nav('/admin/dashboard')} className="text-gray-400 hover:text-gray-700 text-sm">←</button>
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="" className="h-7 w-7" onError={e => { e.currentTarget.style.display = 'none' }} />
          <h1 className="font-black text-gray-900 text-lg sm:text-xl">Tournament Bracket</h1>
        </div>

        {/* Level toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1 ml-2">
          {LEVELS.map(l => (
            <button
              key={l.key}
              onClick={() => setLevel(l.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                level === l.key ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {liveCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
              {liveCount} LIVE
            </span>
          )}
          {updatedAt && (
            <span className="hidden sm:inline text-xs text-gray-400">Updated {updatedAt.toLocaleTimeString()}</span>
          )}
          <button onClick={load} className="text-gray-400 hover:text-primary text-lg font-bold" title="Refresh">↻</button>
        </div>
      </header>

      {/* Board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : columns.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-8">
          <div className="text-5xl">🏸</div>
          <p className="font-bold text-lg text-gray-900">No bracket data yet</p>
          <p className="text-gray-400 text-sm">Matches will appear here as the schedule sheet fills in.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div ref={boardRef} className="relative w-max min-h-full">
            {/* Connector lines — drawn behind the cards */}
            <svg
              className="absolute inset-0 pointer-events-none z-0"
              width={svgSize.w}
              height={svgSize.h}
            >
              {lines.map((l, i) => {
                const dx = Math.max(24, (l.x2 - l.x1) / 2)
                return (
                  <path
                    key={i}
                    d={`M${l.x1},${l.y1} C${l.x1 + dx},${l.y1} ${l.x2 - dx},${l.y2} ${l.x2},${l.y2}`}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="2"
                  />
                )
              })}
            </svg>

            <div className="flex gap-8 p-6 items-start relative z-10">
              {columns.map(col => (
                <section key={col.round} className="shrink-0 w-72">
                  <div className="mb-3 rounded-xl bg-gray-900 text-white px-4 py-2.5 text-center shadow-sm">
                    <p className="font-black text-sm uppercase tracking-wide">{roundLabel(col.round)}</p>
                    <p className="text-[11px] text-white/50">{col.matches.length} matches</p>
                  </div>
                  <div className="space-y-4">
                    {col.matches.map(m => (
                      <BracketMatch
                        key={m.matchNo}
                        m={m}
                        status={statusByNo[m.matchNo]}
                        innerRef={el => {
                          if (el) cardRefs.current.set(m.matchNo, el)
                          else cardRefs.current.delete(m.matchNo)
                        }}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BracketMatch({ m, status, innerRef }) {
  const hasScores = m.team1.scores.some(s => s > 0) || m.team2.scores.some(s => s > 0)
  const rows = [
    { t: m.team1, opp: m.team2 },
    { t: m.team2, opp: m.team1 },
  ]

  return (
    <div
      ref={innerRef}
      className={`rounded-xl border bg-white overflow-hidden shadow-sm ${status === 'live' ? 'border-primary ring-1 ring-primary/30' : 'border-gray-200'}`}
    >
      {/* Meta row */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-[11px] text-gray-400">
        <span className="font-mono font-bold text-gray-500">#{m.matchNo}</span>
        {m.time && <span>{m.time}</span>}
        <span className="ml-auto flex items-center gap-2">
          {m.court && <span className="bg-gray-200 text-gray-600 px-1.5 rounded font-semibold">{m.court}</span>}
          {status === 'live' && (
            <span className="flex items-center gap-1 text-primary font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />LIVE
            </span>
          )}
          {status === 'done' && <span className="text-green-600 font-bold">✓ Done</span>}
        </span>
      </div>

      {/* Team rows */}
      {rows.map((r, i) => {
        const isWin = m.winner && r.t.team === m.winner
        return (
          <div
            key={i}
            className={`flex items-center gap-2 px-3 py-2 ${i ? 'border-t border-gray-100' : ''} ${isWin ? 'bg-green-50' : ''}`}
          >
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold truncate ${isWin ? 'text-green-700' : r.t.team ? 'text-gray-800' : 'text-gray-300'}`}>
                {r.t.team || 'TBD'}{isWin && ' 🏆'}
              </p>
              {r.t.players.length > 0 && (
                <p className="text-[11px] text-gray-400 truncate">{r.t.players.join(' / ')}</p>
              )}
            </div>
            {hasScores && (
              <div className="flex gap-0.5 shrink-0">
                {r.t.scores.map((s, gi) => (
                  <span
                    key={gi}
                    className={`text-sm font-black w-5 text-center ${s > (r.opp.scores[gi] || 0) ? 'text-green-600' : 'text-gray-300'}`}
                  >
                    {s || 0}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
