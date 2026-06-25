import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner'

const COMPANIES = ['COV', 'AVT', 'Thai MFC', 'DOW', 'SOLVAY', 'Styrenix', 'TEX', 'TPAC', 'BEE', 'KNS', 'KNT', 'Other']
const REMEMBER_KEY = 'badminton_email'

export default function CheckIn() {
  const nav = useNavigate()
  const [step, setStep] = useState('home') // 'home' | 'email' | 'confirm' | 'walkin'
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBER_KEY) || '')
  const [found, setFound] = useState(null)
  const [walkin, setWalkin] = useState({ name: '', email: '', company: 'COV' })

  // An existing guest session means the user came back (e.g. browser back) without
  // logging out — offer a one-tap continue instead of forcing a fresh login.
  const rememberedGuest = (() => {
    try { return JSON.parse(sessionStorage.getItem('badminton_guest') || 'null') } catch { return null }
  })()

  async function handleEmailSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      // ILIKE may match multiple rows (duplicate emails / repeat walk-ins), so
      // never use .maybeSingle() here — it 406s on >1 match and would dump the
      // user into walk-in registration, spawning yet another duplicate row.
      // Prefer an already-checked-in row so re-login lands on the existing pass.
      const { data: matches, error } = await supabase
        .from('attendees')
        .select('*')
        .ilike('email', email.trim())
        .order('checked_in', { ascending: false })
        .order('external_id', { ascending: true })
        .limit(1)

      if (error) {
        toast.error('Login failed, please try again')
        return
      }

      const data = matches?.[0]
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
      toast.success('Welcome, ' + found.name + '!')
      saveGuest({ ...found, checked_in: true })
      nav('/guest')
    } finally {
      setLoading(false)
    }
  }

  async function handleWalkInSubmit(e) {
    e.preventDefault()
    if (!walkin.name.trim() || !walkin.email.trim()) return
    setLoading(true)
    try {
      const { data: existing } = await supabase
        .from('attendees')
        .select('external_id')
        .like('external_id', 'W%')

      const maxNum = (existing || []).reduce((max, r) => {
        const n = parseInt(r.external_id.slice(1))
        return isNaN(n) ? max : Math.max(max, n)
      }, 0)
      const externalId = 'W' + (maxNum + 1)
      const { data, error } = await supabase
        .from('attendees')
        .insert({
          external_id: externalId,
          name: walkin.name.trim(),
          email: walkin.email.trim(),
          company: walkin.company,
          // Registration no longer asks for a type — everyone registers as a
          // Basic athlete by default; staff can adjust the category in admin.
          category: 'Basic',
          role: 'athlete',
          checked_in: true,
          check_in_time: new Date().toISOString(),
          walk_in: true,
        })
        .select()
        .single()

      if (error) throw error
      toast.success('Welcome, ' + data.name + '!')
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
      company: data.company,
    }))
    // Remember the email so returning users don't have to retype it.
    const remembered = data.email || email.trim()
    if (remembered) localStorage.setItem(REMEMBER_KEY, remembered)
  }

  // Home screen
  if (step === 'home') {
    return (
      <div className="min-h-dvh flex flex-col bg-gray-50 max-w-lg mx-auto">
        {/* Hero */}
        <div className="bg-gradient-to-b from-slate-400 to-slate-300 px-6 pt-12 pb-10 text-center">
          <img
            src="/logo.svg"
            alt="SMASH Badminton"
            className="mx-auto mb-4 h-24 w-24 drop-shadow-md"
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
          <p className="text-xs font-bold text-white/70 uppercase tracking-widest mb-4">SMASH BADMINTON</p>
          <h1 className="text-4xl font-black text-white leading-tight">Badminton</h1>
          <h2 className="text-3xl font-black text-primary mt-1">Tournament 2026!</h2>
          <p className="text-white/70 text-sm mt-3">
            Corporate badminton tournament. Log in with your email to access your pass.
          </p>
        </div>

        {/* Actions */}
        <div className="flex-1 px-4 py-6 space-y-3">
          {rememberedGuest?.external_id && (
            <button
              onClick={() => nav('/guest')}
              className="btn-primary w-full py-4 text-base"
            >
              <span>→</span> Continue as {rememberedGuest.name}
            </button>
          )}

          <button
            onClick={() => {
              // Coming from a one-tap continue, the email is still the previous
              // guest's — clear it so "log in as someone else" starts blank.
              if (rememberedGuest?.external_id) setEmail('')
              setStep('email')
            }}
            className={rememberedGuest?.external_id ? 'btn-secondary w-full' : 'btn-primary w-full py-4 text-base'}
          >
            {rememberedGuest?.external_id ? 'Log in as someone else' : <><span>→</span> Log in to check in</>}
          </button>

          <p className="text-center text-xs text-gray-400">or</p>

          <button
            onClick={() => setStep('walkin')}
            className="btn-secondary w-full"
          >
            Walk-in Registration
          </button>

          <div className="pt-4 space-y-2">
            <p className="section-label">Event Info</p>
            <button onClick={() => nav('/results')} className="nav-item text-left">
              <div className="flex items-center gap-3">
                <span className="text-lg">🏆</span>
                <span className="font-semibold text-gray-800">Live results</span>
              </div>
              <span className="text-gray-400">›</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-8 text-center">
          <button
            onClick={() => nav('/admin')}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5 mx-auto"
          >
            🛡️ Staff admin
          </button>
          <button
            onClick={() => nav('/referee')}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5 mx-auto mt-2"
          >
            🏸 Referee panel
          </button>
        </div>
      </div>
    )
  }

  // Email step
  if (step === 'email') {
    return (
      <div className="min-h-dvh flex flex-col bg-gray-50 max-w-lg mx-auto">
        <header className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-200">
          <button onClick={() => setStep('home')} className="flex items-center gap-1 text-gray-600 font-semibold">
            <span className="text-lg">←</span> Back
          </button>
          <h2 className="font-bold text-gray-900">Log in</h2>
        </header>
        <div className="flex-1 p-4">
          <form onSubmit={handleEmailSubmit} className="space-y-4 mt-4">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                required
              />
              <p className="text-xs text-gray-400 mt-1">Use the email you registered with</p>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <LoadingSpinner size="sm" /> : 'Continue →'}
            </button>
            <p className="text-center text-sm text-gray-500">
              Not registered?{' '}
              <button type="button" className="text-primary font-semibold" onClick={() => setStep('walkin')}>
                Walk-in here
              </button>
            </p>
          </form>
        </div>
      </div>
    )
  }

  // Confirm check-in
  if (step === 'confirm' && found) {
    return (
      <div className="min-h-dvh flex flex-col bg-gray-50 max-w-lg mx-auto">
        <header className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-200">
          <button onClick={() => { setStep('email'); setFound(null) }} className="flex items-center gap-1 text-gray-600 font-semibold">
            <span className="text-lg">←</span> Back
          </button>
          <h2 className="font-bold text-gray-900">Confirm Check-In</h2>
        </header>
        <div className="p-4 space-y-4 mt-4">
          <div className="card space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-xl font-black text-primary">
                {found.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-lg text-gray-900">{found.name}</p>
                <p className="text-sm text-gray-500">{found.category} · {found.company}</p>
              </div>
            </div>
            <div className="text-sm text-gray-500 space-y-1 bg-gray-50 rounded-xl p-3">
              <p>ID: <span className="text-gray-900 font-mono font-semibold">{found.external_id}</span></p>
              <p>Role: <span className="text-gray-900 capitalize">{found.role}</span></p>
            </div>
          </div>
          <button className="btn-primary w-full" onClick={handleConfirmCheckIn} disabled={loading}>
            {loading ? <LoadingSpinner size="sm" /> : '✅ Confirm Check-In'}
          </button>
        </div>
      </div>
    )
  }

  // Walk-in registration
  return (
    <div className="min-h-dvh flex flex-col bg-gray-50 max-w-lg mx-auto">
      <header className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-200">
        <button onClick={() => setStep('home')} className="flex items-center gap-1 text-gray-600 font-semibold">
          <span className="text-lg">←</span> Back
        </button>
        <h2 className="font-bold text-gray-900">Walk-In Registration</h2>
      </header>
      <div className="flex-1 p-4">
        <form onSubmit={handleWalkInSubmit} className="space-y-4 mt-4">
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
            <label className="label">Email *</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={walkin.email}
              onChange={e => setWalkin(w => ({ ...w, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Company</label>
            <select className="input" value={walkin.company} onChange={e => setWalkin(w => ({ ...w, company: e.target.value }))}>
              {COMPANIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? <LoadingSpinner size="sm" /> : '🏸 Register & Check In'}
          </button>
        </form>
      </div>
    </div>
  )
}
