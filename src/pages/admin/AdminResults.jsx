import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchSchedule } from '../../lib/googleSheet'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/LoadingSpinner'

const EMPTY_ROW = { rank: '', team: '', win: 0, lose: 0, points: 0 }

export default function AdminResults() {
  const [tab, setTab] = useState('schedule') // 'schedule' | 'standings'
  const [schedule, setSchedule] = useState([])
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [results, setResults] = useState([])
  const [motm, setMotm] = useState({ name: '', team: '', image: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const timerRef = useRef(null)
  const [newRow, setNewRow] = useState(EMPTY_ROW)
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editRow, setEditRow] = useState({})

  async function fetchData() {
    const [{ data: rows }, { data: config }] = await Promise.all([
      supabase.from('results').select('*').order('rank'),
      supabase.from('event_config').select('key,value').in('key', ['motm_name', 'motm_team', 'motm_image_url']),
    ])
    setResults(rows || [])
    const cfg = Object.fromEntries((config || []).map(r => [r.key, r.value]))
    setMotm({ name: cfg.motm_name || '', team: cfg.motm_team || '', image: cfg.motm_image_url || '' })
  }

  async function loadSchedule() {
    try {
      const rows = await fetchSchedule()
      setSchedule(rows)
      setLastUpdated(new Date())
    } catch {
      toast.error('Could not fetch schedule from Google Sheet')
    } finally {
      setScheduleLoading(false)
    }
  }

  useEffect(() => {
    fetchData().finally(() => setLoading(false))
    loadSchedule()
    timerRef.current = setInterval(loadSchedule, 60_000)
    return () => clearInterval(timerRef.current)
  }, [])

  async function saveMotm() {
    setSaving(true)
    try {
      await Promise.all([
        supabase.from('event_config').upsert({ key: 'motm_name', value: motm.name }),
        supabase.from('event_config').upsert({ key: 'motm_team', value: motm.team }),
        supabase.from('event_config').upsert({ key: 'motm_image_url', value: motm.image }),
      ])
      toast.success('MOTM saved!')
    } finally {
      setSaving(false)
    }
  }

  async function addRow(e) {
    e.preventDefault()
    if (!newRow.team || !newRow.rank) return
    const { error } = await supabase.from('results').insert({
      rank: Number(newRow.rank),
      team: newRow.team.trim(),
      win: Number(newRow.win),
      lose: Number(newRow.lose),
      points: Number(newRow.points),
    })
    if (error) { toast.error('Failed to add row'); return }
    toast.success('Row added!')
    setNewRow(EMPTY_ROW)
    setShowAdd(false)
    fetchData()
  }

  async function saveEdit(id) {
    await supabase.from('results').update({
      rank: Number(editRow.rank),
      team: editRow.team,
      win: Number(editRow.win),
      lose: Number(editRow.lose),
      points: Number(editRow.points),
    }).eq('id', id)
    toast.success('Updated!')
    setEditId(null)
    fetchData()
  }

  async function deleteRow(id) {
    if (!confirm('Delete this row?')) return
    await supabase.from('results').delete().eq('id', id)
    fetchData()
  }

  const live = schedule.filter(r => r.status === 'live')
  const done = schedule.filter(r => r.status === 'done')
  const upcoming = schedule.filter(r => r.status === 'upcoming')

  if (loading) return <div className="flex justify-center pt-12"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-black text-2xl">Results & Schedule</h1>
        {live.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            {live.length} LIVE
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {['schedule', 'standings'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t === 'schedule' ? '📋 ตารางแข่ง (Live)' : '🏆 Standings'}
          </button>
        ))}
      </div>

      {/* Live Schedule tab */}
      {tab === 'schedule' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString()}</span>}
              <span>· auto-refresh 60s</span>
            </div>
            <button onClick={loadSchedule} className="text-xs text-primary font-semibold">↻ Refresh</button>
          </div>

          {scheduleLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner size="lg" /></div>
          ) : schedule.length === 0 ? (
            <div className="card text-center py-8 text-gray-400 text-sm">ยังไม่มีข้อมูลจาก Google Sheet</div>
          ) : (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'LIVE', value: live.length, color: 'text-primary' },
                  { label: 'Upcoming', value: upcoming.length, color: 'text-amber-600' },
                  { label: 'Done', value: done.length, color: 'text-green-600' },
                ].map(s => (
                  <div key={s.label} className="card text-center py-3">
                    <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Full table */}
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs uppercase bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-2">#</th>
                        <th className="text-left px-3 py-2">รอบ</th>
                        <th className="text-left px-3 py-2">รุ่น</th>
                        <th className="text-left px-3 py-2">เวลา</th>
                        <th className="text-left px-3 py-2">สถานะ</th>
                        <th className="text-left px-3 py-2">สนาม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((r, i) => (
                        <tr key={r.matchNo} className={`border-t border-gray-100 ${r.status === 'live' ? 'bg-primary/5' : ''}`}>
                          <td className="px-3 py-2.5 font-mono text-gray-500">{r.matchNo}</td>
                          <td className="px-3 py-2.5 text-gray-800 text-xs">{r.round}</td>
                          <td className="px-3 py-2.5 text-gray-500 text-xs">{r.category}</td>
                          <td className="px-3 py-2.5 text-gray-500 text-xs">{r.time}</td>
                          <td className="px-3 py-2.5">
                            {r.status === 'live' && (
                              <span className="flex items-center gap-1 text-xs font-bold text-primary">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />LIVE
                              </span>
                            )}
                            {r.status === 'done' && <span className="text-xs font-bold text-green-600">✓ จบ</span>}
                            {r.status === 'upcoming' && <span className="text-xs text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-xs font-semibold text-gray-700">{r.courtRaw || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Standings tab */}
      {tab === 'standings' && (
        <div className="space-y-5">

      {/* MOTM editor */}
      <div className="card space-y-3">
        <h2 className="font-bold flex items-center gap-2">⭐ Man of the Match</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={motm.name} onChange={e => setMotm(m => ({ ...m, name: e.target.value }))} placeholder="Player name" />
          </div>
          <div>
            <label className="label">Team</label>
            <input className="input" value={motm.team} onChange={e => setMotm(m => ({ ...m, team: e.target.value }))} placeholder="Team name" />
          </div>
        </div>
        <div>
          <label className="label">Photo URL</label>
          <input className="input" value={motm.image} onChange={e => setMotm(m => ({ ...m, image: e.target.value }))} placeholder="https://..." />
        </div>
        {motm.image && (
          <img src={motm.image} alt="MOTM preview" className="w-16 h-16 rounded-full object-cover border-2 border-shuttle" />
        )}
        <button onClick={saveMotm} className="btn-primary w-full" disabled={saving}>
          {saving ? 'Saving...' : '💾 Save MOTM'}
        </button>
      </div>

      {/* Results table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-bold">🏆 Standings</h2>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm py-1.5 px-3">+ Add Row</button>
        </div>

        {results.length === 0 ? (
          <p className="p-4 text-gray-500 text-sm">No results yet. Add rows above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase bg-gray-50">
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">Team</th>
                  <th className="text-center px-2 py-2">W</th>
                  <th className="text-center px-2 py-2">L</th>
                  <th className="text-center px-2 py-2">Pts</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  editId === r.id ? (
                    <tr key={r.id} className="border-t border-gray-200 bg-gray-50">
                      <td className="px-2 py-2"><input className="input w-12 text-center text-sm py-1" type="number" value={editRow.rank} onChange={e => setEditRow(x => ({ ...x, rank: e.target.value }))} /></td>
                      <td className="px-2 py-2"><input className="input text-sm py-1" value={editRow.team} onChange={e => setEditRow(x => ({ ...x, team: e.target.value }))} /></td>
                      <td className="px-2 py-2"><input className="input w-12 text-center text-sm py-1" type="number" value={editRow.win} onChange={e => setEditRow(x => ({ ...x, win: e.target.value }))} /></td>
                      <td className="px-2 py-2"><input className="input w-12 text-center text-sm py-1" type="number" value={editRow.lose} onChange={e => setEditRow(x => ({ ...x, lose: e.target.value }))} /></td>
                      <td className="px-2 py-2"><input className="input w-14 text-center text-sm py-1" type="number" value={editRow.points} onChange={e => setEditRow(x => ({ ...x, points: e.target.value }))} /></td>
                      <td className="px-2 py-2 flex gap-1">
                        <button onClick={() => saveEdit(r.id)} className="text-xs text-primary font-bold">Save</button>
                        <button onClick={() => setEditId(null)} className="text-xs text-gray-500">Cancel</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} className="border-t border-gray-200">
                      <td className="px-3 py-3">{r.rank}</td>
                      <td className="px-3 py-3 font-medium">{r.team}</td>
                      <td className="px-2 py-3 text-center text-primary">{r.win}</td>
                      <td className="px-2 py-3 text-center text-red-400">{r.lose}</td>
                      <td className="px-2 py-3 text-center font-bold">{r.points}</td>
                      <td className="px-2 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => { setEditId(r.id); setEditRow({ rank: r.rank, team: r.team, win: r.win, lose: r.lose, points: r.points }) }} className="text-xs text-amber-600">Edit</button>
                          <button onClick={() => deleteRow(r.id)} className="text-xs text-red-400">Del</button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add row modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-xs p-5 space-y-4">
            <h3 className="font-bold">Add Result Row</h3>
            <form onSubmit={addRow} className="space-y-3">
              <div className="flex gap-2">
                <div className="w-20">
                  <label className="label">Rank</label>
                  <input className="input" type="number" min="1" value={newRow.rank} onChange={e => setNewRow(r => ({ ...r, rank: e.target.value }))} required />
                </div>
                <div className="flex-1">
                  <label className="label">Team *</label>
                  <input className="input" value={newRow.team} onChange={e => setNewRow(r => ({ ...r, team: e.target.value }))} required autoFocus />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label">Win</label>
                  <input className="input" type="number" min="0" value={newRow.win} onChange={e => setNewRow(r => ({ ...r, win: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Lose</label>
                  <input className="input" type="number" min="0" value={newRow.lose} onChange={e => setNewRow(r => ({ ...r, lose: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Pts</label>
                  <input className="input" type="number" min="0" value={newRow.points} onChange={e => setNewRow(r => ({ ...r, points: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  )
}
