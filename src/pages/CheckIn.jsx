import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner'

const COMPANIES = ['COV', 'AVT', 'Thai MFC', 'Other']
const CATEGORIES = ['Basic', 'Expert', 'Substitute', 'Spectator']

export default function CheckIn() {
  const nav = useNavigate()
  const [step, setStep] = useState('email') // 'email' | 'confirm' | 'walkin'
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [found, setFound] = useState(null)
  const [walkin, setWalkin] = useState({ name: '', company: 'COV', category: 'Basic' })

  async function handleEmailSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('attendees')
        .select('*')
        .ilike('email', email.trim())
        .maybeSingle()

      if (data) {
        if (data.checked_in) {
          toast('Already checked in as ' + data.name, { icon: '✅' })
          saveGuest(data)
          nav('/guest')
          return
        }
        setFound(data)
        setStep('confirm')
      } else {
        setStep('walkin')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmCheckIn() {
    setLoading(true)
    try {
      await supabase
        .from('attendees')
        .update({ checked_in: true, check_in_time: new Date().toISOString() })
        .eq('id', found.id)
      toast.success('Welcome, ' + found.name + '! 🏸')
      saveGuest({ ...found, checked_in: true })
      nav('/guest')
    } finally {
      setLoading(false)
    }
  }

  async function handleWalkInSubmit(e) {
    e.preventDefault()
    if (!walkin.name.trim()) return
    setLoading(true)
    try {
      const { count } = await supabase
        .from('attendees')
        .select('*', { count: 'exact', head: true })
        .eq('walk_in', true)

      const externalId = 'W' + ((count ?? 0) + 1)
      const { data, error } = await supabase
        .from('attendees')
        .insert({
          external_id: externalId,
          name: walkin.name.trim(),
          email: email.trim() || null,
          company: walkin.company,
          category: walkin.category,
          role: walkin.category === 'Spectator' ? 'spectator' : 'athlete',
          checked_in: true,
          check_in_time: new Date().toISOString(),
          walk_in: true,
        })
        .select()
        .single()

      if (error) throw error
      toast.success('Welcome, ' + data.name + '! 🏸')
      saveGuest(data)
      nav('/guest')
    } catch (err) {
      console.error('Registration error:', err)
      toast.error(err?.message || 'Registration failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function saveGuest(data) {
    sessionStorage.setItem('badminton_guest', JSON.stringify({
      external_id: data.external_id,
      name: data.name,
      category: data.category,
      role: data.role,
    }))
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4 bg-dark-bg">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-5xl mb-2">🏸</div>
          <h1 className="text-3xl font-black tracking-tight">SMASH</h1>
          <p className="text-gray-400 text-sm">Badminton Tournament 2024</p>
        </div>

        {/* Email step */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="card space-y-4">
            <h2 className="font-bold text-lg">Check In</h2>
            <div>
              <label className="label">Your Email</label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <LoadingSpinner size="sm" /> : 'Continue →'}
            </button>
            <p className="text-center text-xs text-gray-500">
              Walking in?{' '}
              <button
                type="button"
                className="text-court underline"
                onClick={() => setStep('walkin')}
              >
                Register here
              </button>
            </p>
          </form>
        )}

        {/* Confirm pre-registered guest */}
        {step === 'confirm' && found && (
          <div className="card space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-court/20 border border-court/30 flex items-center justify-center text-xl font-black text-court">
                {found.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-lg">{found.name}</p>
                <p className="text-sm text-gray-400">{found.category} · {found.company}</p>
              </div>
            </div>
            <div className="text-sm text-gray-400 space-y-1">
              <p>ID: <span className="text-white font-mono">{found.external_id}</span></p>
              <p>Role: <span className="text-white capitalize">{found.role}</span></p>
            </div>
            <button className="btn-primary w-full" onClick={handleConfirmCheckIn} disabled={loading}>
              {loading ? <LoadingSpinner size="sm" /> : '✅ Confirm Check-In'}
            </button>
            <button className="btn-secondary w-full text-sm" onClick={() => { setStep('email'); setFound(null) }}>
              ← Back
            </button>
          </div>
        )}

        {/* Walk-in registration */}
        {step === 'walkin' && (
          <form onSubmit={handleWalkInSubmit} className="card space-y-4">
            <h2 className="font-bold text-lg">Walk-In Registration</h2>
            <div>
              <label className="label">Full Name *</label>
              <input
                className="input"
                placeholder="Your name"
                value={walkin.name}
                onChange={e => setWalkin(w => ({ ...w, name: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Email (optional)</label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Company</label>
              <select
                className="input"
                value={walkin.company}
                onChange={e => setWalkin(w => ({ ...w, company: e.target.value }))}
              >
                {COMPANIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select
                className="input"
                value={walkin.category}
                onChange={e => setWalkin(w => ({ ...w, category: e.target.value }))}
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <LoadingSpinner size="sm" /> : '🏸 Register & Check In'}
            </button>
            <button type="button" className="btn-secondary w-full text-sm" onClick={() => setStep('email')}>
              ← Back
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
