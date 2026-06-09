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
    const ch = supabase.channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendees' }, fetchData)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  if (loading) return <div className="flex justify-center pt-12"><LoadingSpinner size="lg" /></div>

  const pct = stats.total ? Math.round((stats.checked / stats.total) * 100) : 0

  return (
    <div className="space-y-4 py-4">
      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-900' },
          { label: 'Checked In', value: stats.checked, color: 'text-primary' },
          { label: 'Athletes', value: stats.athletes, color: 'text-blue-600' },
          { label: 'Followers', value: stats.spectators, color: 'text-purple-600' },
        ].map(s => (
          <div key={s.label} className="card py-3">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label.toUpperCase()}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="card space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Attendance</span>
          <span className="font-bold text-primary">{pct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Live check-ins */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <h2 className="font-bold text-gray-900">Live Check-ins</h2>
        </div>
        {recent.length === 0 ? (
          <p className="p-4 text-gray-400 text-sm">No check-ins yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recent.map(a => (
              <li key={a.external_id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-gray-900">{a.name}</p>
                  <p className="text-xs text-gray-400">{a.company} · {a.category}</p>
                </div>
                <div className="text-right">
                  <span className="badge bg-gray-100 text-gray-500 font-mono">{a.external_id}</span>
                  <p className="text-xs text-gray-400 mt-1">
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
