import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchSchedule } from '../lib/googleSheet'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ResultsPage() {
  const nav = useNavigate()
  const [schedule, setSchedule] = useState([])
  const [results, setResults] = useState([])
  const [motm, setMotm] = useState({})
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [tab, setTab] = useState('schedule')
  const timerRef = useRef(null)

  async function load() {
    try {
      const [rows, { data: standing }, { data: cfg }] = await Promise.all([
        fetchSchedule(),
        supabase.from('results').select('*').order('rank'),
        supabase.from('event_config').select('key,value').in('key', ['motm_name', 'motm_team', 'motm_image_url']),
      ])
      setSchedule(rows)
      setResults(standing || [])
      const c = Object.fromEntries((cfg || []).map(r => [r.key, r.value]))
      setMotm({ name: c.motm_name, team: c.motm_team, image: c.motm_image_url })
      setLastUpdated(new Date())
    } catch {
      // non-critical
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, 60_000)
    return () => clearInterval(timerRef.current)
  }, [])

  const live = schedule.filter(r => r.status === 'live')
  const upcoming = schedule.filter(r => r.status === 'upcoming')
  const done = schedule.filter(r => r.status === 'done')

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50 max-w-lg mx-auto">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => nav('/')} className="text-gray-500 font-medium">←</button>
        <div className="flex-1">
          <h2 className="font-bold text-gray-900">Live Results</h2>
          {lastUpdated && (
            <p className="text-xs text-gray-400">Updated {lastUpdated.toLocaleTimeString()}</p>
          )}
        </div>
        {live.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
            {live.length} LIVE
          </span>
        )}
        <button onClick={load} className="text-gray-400 hover:text-primary text-lg font-bold">↻</button>
      </header>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-200">
        {[
          { key: 'schedule', label: '📋 ตารางแข่ง' },
          { key: 'standings', label: '🏆 อันดับ' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === t.key
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-8">
          {/* Schedule tab */}
          {tab === 'schedule' && (
            <div className="p-4 space-y-4">
              {schedule.length === 0 && (
                <div className="flex flex-col items-center py-16 text-center gap-3">
                  <div className="text-4xl">📋</div>
                  <p className="text-gray-400 text-sm">ยังไม่มีข้อมูลตารางแข่ง</p>
                </div>
              )}

              {/* Stats */}
              {schedule.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'กำลังแข่ง', value: live.length, color: 'text-primary', bg: 'bg-primary/5' },
                    { label: 'รอแข่ง', value: upcoming.length, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'จบแล้ว', value: done.length, color: 'text-green-600', bg: 'bg-green-50' },
                  ].map(s => (
                    <div key={s.label} className={`card text-center py-3 ${s.bg}`}>
                      <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {live.length > 0 && <ScheduleGroup label="🔴 กำลังแข่งขัน" rows={live} defaultOpen />}
              {upcoming.length > 0 && <ScheduleGroup label="⏰ รอแข่ง" rows={upcoming} defaultOpen />}
              {done.length > 0 && <ScheduleGroup label="✅ แข่งจบแล้ว" rows={done} defaultOpen={false} />}
            </div>
          )}

          {/* Standings tab */}
          {tab === 'standings' && (
            <div className="p-4 space-y-4">
              {motm?.name && (
                <div className="card bg-amber-50 border-amber-200 space-y-3">
                  <p className="text-amber-600 font-black text-xs uppercase tracking-widest">⭐ Man of the Match</p>
                  <div className="flex items-center gap-3">
                    {motm.image && (
                      <img src={motm.image} alt={motm.name} className="w-14 h-14 rounded-full object-cover border-2 border-amber-400" />
                    )}
                    <div>
                      <p className="font-black text-xl text-gray-900">{motm.name}</p>
                      <p className="text-amber-600 text-sm">{motm.team}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="card p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900">🏆 Standings</h3>
                </div>
                {results.length === 0 ? (
                  <p className="p-4 text-gray-400 text-sm text-center">ยังไม่มีอันดับ</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-xs uppercase bg-gray-50">
                        <th className="text-left px-4 py-2">#</th>
                        <th className="text-left px-4 py-2">Team</th>
                        <th className="text-center px-3 py-2">W</th>
                        <th className="text-center px-3 py-2">L</th>
                        <th className="text-center px-3 py-2">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <tr key={r.id} className={`border-t border-gray-100 ${i === 0 ? 'bg-amber-50' : ''}`}>
                          <td className="px-4 py-3 text-gray-500 font-mono">{r.rank}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900">{r.team}</td>
                          <td className="px-3 py-3 text-center text-green-600 font-bold">{r.win}</td>
                          <td className="px-3 py-3 text-center text-primary">{r.lose}</td>
                          <td className="px-3 py-3 text-center font-black text-gray-900">{r.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ScheduleGroup({ label, rows, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card p-0 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
      >
        <span className="font-bold text-sm text-gray-800">{label}</span>
        <span className="text-gray-400 text-xs">{rows.length} แมตช์ {open ? '▲' : '▼'}</span>
      </button>
      {open && rows.map((r, i) => (
        <div
          key={r.matchNo}
          className={`flex items-center gap-3 px-4 py-3 text-sm ${i > 0 ? 'border-t border-gray-100' : ''} ${r.status === 'live' ? 'bg-primary/5' : ''}`}
        >
          <span className="font-mono text-gray-400 text-xs w-8 shrink-0">#{r.matchNo}</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{r.round}</p>
            <p className="text-xs text-gray-400">{r.category} · {r.time}</p>
          </div>
          {r.courtRaw && (
            <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-lg shrink-0">
              {r.courtRaw}
            </span>
          )}
          {r.status === 'live' && (
            <span className="flex items-center gap-1 text-xs font-bold text-primary shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />LIVE
            </span>
          )}
          {r.status === 'done' && <span className="text-xs font-bold text-green-600 shrink-0">✓</span>}
        </div>
      ))}
    </div>
  )
}
