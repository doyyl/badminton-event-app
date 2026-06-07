import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/LoadingSpinner'

const COMPANIES = ['All', 'COV', 'AVT', 'Thai MFC', 'Other']
const CATEGORIES_ALL = ['All', 'Basic', 'Expert', 'Substitute', 'Spectator']

export default function AdminAttendees() {
  const [attendees, setAttendees] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCompany, setFilterCompany] = useState('All')
  const [filterCategory, setFilterCategory] = useState('All')
  const [showAddWalkin, setShowAddWalkin] = useState(false)
  const [walkin, setWalkin] = useState({ name: '', email: '', company: 'COV', category: 'Basic' })
  const [saving, setSaving] = useState(false)

  async function fetchAttendees() {
    const { data } = await supabase
      .from('attendees')
      .select('*')
      .order('created_at', { ascending: false })
    setAttendees(data || [])
  }

  useEffect(() => {
    fetchAttendees().finally(() => setLoading(false))

    const channel = supabase
      .channel('attendees-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendees' }, fetchAttendees)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function toggleCheckIn(a) {
    const newVal = !a.checked_in
    await supabase
      .from('attendees')
      .update({ checked_in: newVal, check_in_time: newVal ? new Date().toISOString() : null })
      .eq('id', a.id)
    toast.success(newVal ? `${a.name} checked in` : `${a.name} checked out`)
  }

  async function addWalkin(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { count } = await supabase
        .from('attendees')
        .select('*', { count: 'exact', head: true })
        .eq('walk_in', true)

      await supabase.from('attendees').insert({
        external_id: 'W' + ((count ?? 0) + 1),
        name: walkin.name.trim(),
        email: walkin.email.trim() || null,
        company: walkin.company,
        category: walkin.category,
        role: walkin.category === 'Spectator' ? 'spectator' : 'athlete',
        checked_in: true,
        check_in_time: new Date().toISOString(),
        walk_in: true,
      })

      toast.success('Walk-in added!')
      setShowAddWalkin(false)
      setWalkin({ name: '', email: '', company: 'COV', category: 'Basic' })
    } catch {
      toast.error('Failed to add walk-in')
    } finally {
      setSaving(false)
    }
  }

  const filtered = attendees.filter(a => {
    const q = search.toLowerCase()
    const matchSearch = !q || a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q) || a.external_id?.toLowerCase().includes(q)
    const matchCompany = filterCompany === 'All' || a.company === filterCompany
    const matchCat = filterCategory === 'All' || a.category === filterCategory
    return matchSearch && matchCompany && matchCat
  })

  const checkedIn = filtered.filter(a => a.checked_in).length

  if (loading) return <div className="flex justify-center pt-12"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-black text-2xl">Attendees</h1>
        <button onClick={() => setShowAddWalkin(true)} className="btn-primary text-sm py-2 px-4">
          + Walk-in
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="card py-2">
          <p className="text-lg font-black text-court">{attendees.filter(a => a.checked_in).length}</p>
          <p className="text-xs text-gray-500">Checked In</p>
        </div>
        <div className="card py-2">
          <p className="text-lg font-black text-blue-400">{attendees.filter(a => a.role === 'athlete' && a.checked_in).length}</p>
          <p className="text-xs text-gray-500">Athletes</p>
        </div>
        <div className="card py-2">
          <p className="text-lg font-black text-purple-400">{attendees.filter(a => a.role === 'spectator' && a.checked_in).length}</p>
          <p className="text-xs text-gray-500">Spectators</p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <input
          className="input text-sm"
          placeholder="Search name, email, ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-2">
          <select className="input text-sm flex-1" value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
            {COMPANIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="input text-sm flex-1" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            {CATEGORIES_ALL.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <p className="text-xs text-gray-500">Showing {filtered.length} · {checkedIn} checked in</p>
      </div>

      {/* List */}
      <div className="card p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-4 text-gray-500 text-sm">No attendees found.</p>
        ) : (
          <ul className="divide-y divide-dark-border">
            {filtered.map(a => (
              <li key={a.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{a.name}</p>
                    {a.walk_in && <span className="badge bg-shuttle/20 text-shuttle text-xs">WI</span>}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{a.external_id} · {a.company} · {a.category}</p>
                  {a.email && <p className="text-xs text-gray-600 truncate">{a.email}</p>}
                </div>
                <button
                  onClick={() => toggleCheckIn(a)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                    a.checked_in
                      ? 'bg-court/20 text-court border border-court/30'
                      : 'bg-dark-muted text-gray-400 border border-dark-border'
                  }`}
                >
                  {a.checked_in ? '✓ In' : 'Check In'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add walk-in modal */}
      {showAddWalkin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-bold text-lg">Add Walk-in</h3>
            <form onSubmit={addWalkin} className="space-y-3">
              <div>
                <label className="label">Full Name *</label>
                <input className="input" placeholder="Name" value={walkin.name} onChange={e => setWalkin(w => ({ ...w, name: e.target.value }))} required autoFocus />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" placeholder="email (optional)" value={walkin.email} onChange={e => setWalkin(w => ({ ...w, email: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="label">Company</label>
                  <select className="input" value={walkin.company} onChange={e => setWalkin(w => ({ ...w, company: e.target.value }))}>
                    {['COV', 'AVT', 'Thai MFC', 'Other'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="label">Category</label>
                  <select className="input" value={walkin.category} onChange={e => setWalkin(w => ({ ...w, category: e.target.value }))}>
                    {['Basic', 'Expert', 'Substitute', 'Spectator'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAddWalkin(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? '...' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
