import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/LoadingSpinner'

const COMPANIES = ['All', 'COV', 'AVT', 'Thai MFC', 'DOW', 'SOLVAY', 'Styrenix', 'TEX', 'TPAC', 'BEE', 'KNS', 'KNT', 'Other']
const CATEGORIES_ALL = ['All', 'Basic', 'Expert', 'Substitute', 'Follower']

function Toggle({ on, onChange }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? 'bg-primary' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export default function AdminAttendees() {
  const [attendees, setAttendees] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCompany, setFilterCompany] = useState('All')
  const [showAddWalkin, setShowAddWalkin] = useState(false)
  const [walkin, setWalkin] = useState({ name: '', email: '', company: 'COV', category: 'Basic' })
  const [saving, setSaving] = useState(false)

  async function fetchAttendees() {
    const { data } = await supabase.from('attendees').select('*').order('created_at', { ascending: false })
    setAttendees(data || [])
  }

  useEffect(() => {
    fetchAttendees().finally(() => setLoading(false))
    const ch = supabase.channel('attendees-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendees' }, fetchAttendees)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function toggleCheckIn(a) {
    const newVal = !a.checked_in
    await supabase
      .from('attendees')
      .update({ checked_in: newVal, check_in_time: newVal ? new Date().toISOString() : null })
      .eq('id', a.id)
    toast.success(newVal ? `${a.name} checked in` : `${a.name} checked out`)
  }

  async function resetAll() {
    if (!confirm('Reset ALL check-ins?')) return
    await supabase.from('attendees').update({ checked_in: false, check_in_time: null }).neq('id', '00000000-0000-0000-0000-000000000000')
    toast.success('All check-ins reset')
  }

  async function addWalkin(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { count } = await supabase.from('attendees').select('*', { count: 'exact', head: true }).eq('walk_in', true)
      await supabase.from('attendees').insert({
        external_id: 'W' + ((count ?? 0) + 1),
        name: walkin.name.trim(),
        email: walkin.email.trim() || null,
        company: walkin.company,
        category: walkin.category,
        role: walkin.category === 'Follower' ? 'spectator' : 'athlete',
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
    return matchSearch && matchCompany
  })

  const checkedIn = attendees.filter(a => a.checked_in).length
  const athletes = attendees.filter(a => a.checked_in && a.role === 'athlete').length
  const spectators = attendees.filter(a => a.checked_in && a.role === 'spectator').length

  if (loading) return <div className="flex justify-center pt-12"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-4 py-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Total', value: attendees.length },
          { label: 'Checked In', value: checkedIn },
          { label: 'Athletes', value: athletes },
          { label: 'Followers', value: spectators },
        ].map(s => (
          <div key={s.label} className="card py-3">
            <p className="text-xl font-black text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400">{s.label.toUpperCase()}</p>
          </div>
        ))}
      </div>

      {/* Search + Add */}
      <div className="flex gap-2">
        <input
          className="input text-sm flex-1"
          placeholder="Search name/email/id..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input text-sm w-28" value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
          {COMPANIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <button onClick={() => setShowAddWalkin(true)} className="btn-primary text-sm py-2 px-4 whitespace-nowrap">
          + Add
        </button>
      </div>

      {/* List */}
      <div className="card p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-4 text-gray-400 text-sm">No attendees found.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map(a => (
              <li key={a.id} className="px-4 py-3.5 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{a.name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {a.external_id} · {a.company} · {a.category}
                    {a.walk_in && <span className="text-primary"> ·walk-in</span>}
                  </p>
                </div>
                <Toggle on={a.checked_in} onChange={() => toggleCheckIn(a)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Reset */}
      <button
        onClick={resetAll}
        className="w-full py-3.5 rounded-xl border border-gray-200 bg-white text-gray-500 text-sm font-semibold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
      >
        ↺ Reset all check-ins
      </button>

      {/* Add walk-in modal */}
      {showAddWalkin && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-xl">
            <h3 className="font-bold text-lg text-gray-900">Add Walk-in</h3>
            <form onSubmit={addWalkin} className="space-y-3">
              <div>
                <label className="label">Full Name *</label>
                <input className="input" placeholder="Name" value={walkin.name} onChange={e => setWalkin(w => ({ ...w, name: e.target.value }))} required autoFocus />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" placeholder="optional" value={walkin.email} onChange={e => setWalkin(w => ({ ...w, email: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="label">Company</label>
                  <select className="input" value={walkin.company} onChange={e => setWalkin(w => ({ ...w, company: e.target.value }))}>
                    {['COV', 'AVT', 'Thai MFC', 'DOW', 'SOLVAY', 'Styrenix', 'TEX', 'TPAC', 'BEE', 'KNS', 'KNT', 'Other'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="label">Category</label>
                  <select className="input" value={walkin.category} onChange={e => setWalkin(w => ({ ...w, category: e.target.value }))}>
                    {['Basic', 'Expert', 'Substitute', 'Follower'].map(c => <option key={c}>{c}</option>)}
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
