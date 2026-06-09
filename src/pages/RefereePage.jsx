import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'

const REF_PASSWORD = import.meta.env.VITE_REFEREE_PASSWORD || 'referee2024'
const COURTS = Array.from({ length: 10 }, (_, i) => i + 1)

export default function RefereePage() {
  const nav = useNavigate()
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem('badminton_referee'))
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [courtStatus, setCourtStatus] = useState({}) // courtId -> status
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authed) fetchCourtStatuses()
  }, [authed])

  async function fetchCourtStatuses() {
    const { data } = await supabase
      .from('matches')
      .select('court_id, status')
      .in('status', ['scheduled', 'active'])
    const map = {}
    ;(data || []).forEach(m => { map[m.court_id] = m.status })
    setCourtStatus(map)
    setLoading(false)
  }

  function handleLogin(e) {
    e.preventDefault()
    if (pw === REF_PASSWORD) {
      sessionStorage.setItem('badminton_referee', '1')
      setAuthed(true)
    } else {
      setErr('Incorrect password')
    }
  }

  if (!authed) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50 p-4">
        <form onSubmit={handleLogin} className="card w-full max-w-sm space-y-5">
          <div className="text-center space-y-2">
            <div className="text-5xl">🏸</div>
            <h1 className="font-black text-2xl">Referee Panel</h1>
            <p className="text-gray-400 text-sm">Enter referee password to continue</p>
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={pw}
              onChange={e => { setPw(e.target.value); setErr('') }}
              autoFocus
              required
            />
            {err && <p className="text-red-400 text-sm mt-1">{err}</p>}
          </div>
          <button type="submit" className="btn-primary w-full">Enter</button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gray-50 p-4 max-w-lg mx-auto">
      <div className="py-4 flex items-center justify-between">
        <div>
          <h1 className="font-black text-2xl">Referee Panel</h1>
          <p className="text-gray-400 text-sm">Select your court to manage</p>
        </div>
        <button
          onClick={() => { sessionStorage.removeItem('badminton_referee'); setAuthed(false) }}
          className="text-gray-500 text-xs hover:text-white"
        >
          Logout
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {COURTS.map(n => {
            const status = courtStatus[n]
            return (
              <button
                key={n}
                onClick={() => nav(`/referee/${n}`)}
                className="card flex flex-col items-center gap-2 py-6 hover:border-primary hover:bg-primary/5 transition-all text-center"
              >
                <span className="text-3xl">🏟️</span>
                <span className="font-black text-lg">Court {n}</span>
                {status === 'active' && (
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">● Live</span>
                )}
                {status === 'scheduled' && (
                  <span className="text-xs font-semibold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">Scheduled</span>
                )}
                {!status && (
                  <span className="text-xs text-gray-600">Vacant</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
