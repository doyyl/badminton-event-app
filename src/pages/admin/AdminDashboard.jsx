import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, checked: 0, athletes: 0, spectators: 0, walkins: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    const { data } = await supabase
      .from('attendees')
      .select('checked_in, role, walk_in, name, external_id, check_in_time, company, category')
      .order('check_in_time', { ascending: false })

    if (!data) return

    const checked = data.filter(a => a.checked_in)
    setStats({
      total: data.length,
      checked: checked.length,
      athletes: checked.filter(a => a.role === 'athlete').length,
      spectators: checked.filter(a => a.role === 'spectator').length,
      walkins: checked.filter(a => a.walk_in).length,
    })
    setRecent(checked.slice(0, 20))
  }

  useEffect(() => {
    fetchData().finally(() => setLoading(false))

    const channel = supabase
      .channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendees' }, fetchData)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  if (loading) return <div className="flex justify-center pt-12"><LoadingSpinner size="lg" /></div>

  const pct = stats.total ? Math.round((stats.checked / stats.total) * 100) : 0

  return (
    <div className="space-y-5">
      <h1 className="font-black text-2xl">Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Checked In" value={`${stats.checked}/${stats.total}`} sub={`${pct}%`} color="text-court" />
        <StatCard label="Athletes" value={stats.athletes} color="text-blue-400" />
        <StatCard label="Spectators" value={stats.spectators} color="text-purple-400" />
        <StatCard label="Walk-ins" value={stats.walkins} color="text-shuttle" />
      </div>

      {/* Overall progress */}
      <div className="card space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Overall attendance</span>
          <span className="font-bold text-court">{pct}%</span>
        </div>
        <div className="h-3 bg-dark-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-court to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Recent check-ins */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-court animate-pulse" />
          <h2 className="font-bold">Live Check-ins</h2>
        </div>
        {recent.length === 0 ? (
          <p className="p-4 text-gray-500 text-sm">No check-ins yet.</p>
        ) : (
          <ul className="divide-y divide-dark-border">
            {recent.map(a => (
              <li key={a.external_id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{a.name}</p>
                  <p className="text-xs text-gray-500">{a.company} · {a.category}</p>
                </div>
                <div className="text-right">
                  <span className="badge bg-dark-muted text-gray-300">{a.external_id}</span>
                  <p className="text-xs text-gray-500 mt-1">
                    {a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="card text-center space-y-1">
      <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-gray-500 text-sm">{sub}</p>}
    </div>
  )
}
