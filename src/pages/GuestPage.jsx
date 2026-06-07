import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { FOOD_META } from '../lib/foodMeta'
import AnnouncementBanner from '../components/AnnouncementBanner'
import LoadingSpinner from '../components/LoadingSpinner'

const TABS = [
  { id: 'food', label: '🍽️ Food', },
  { id: 'results', label: '🏆 Results' },
  { id: 'seating', label: '📍 Seating' },
]

export default function GuestPage() {
  const nav = useNavigate()
  const guest = JSON.parse(sessionStorage.getItem('badminton_guest') || '{}')
  const [tab, setTab] = useState('food')
  const [foodItems, setFoodItems] = useState([])
  const [claims, setClaims] = useState([]) // array of { item_id }
  const [results, setResults] = useState([])
  const [motm, setMotm] = useState({})
  const [seatingUrl, setSeatingUrl] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchFood = useCallback(async () => {
    const [{ data: items }, { data: myClaims }] = await Promise.all([
      supabase.from('food_items').select('*').order('id'),
      supabase.from('food_claims')
        .select('item_id')
        .eq('attendee_external_id', guest.external_id),
    ])
    setFoodItems(items || [])
    setClaims(myClaims || [])
  }, [guest.external_id])

  const fetchResults = useCallback(async () => {
    const { data } = await supabase.from('results').select('*').order('rank')
    setResults(data || [])
  }, [])

  const fetchConfig = useCallback(async () => {
    const { data } = await supabase.from('event_config').select('key,value')
    const cfg = Object.fromEntries((data || []).map(r => [r.key, r.value]))
    setMotm({ name: cfg.motm_name, team: cfg.motm_team, image: cfg.motm_image_url })
    setSeatingUrl(cfg.seating_map_url || '')
  }, [])

  useEffect(() => {
    if (!guest.external_id) { nav('/'); return }
    Promise.all([fetchFood(), fetchResults(), fetchConfig()]).finally(() => setLoading(false))

    // Realtime: food claims for this guest
    const claimsChannel = supabase
      .channel('my-claims')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'food_claims',
        filter: `attendee_external_id=eq.${guest.external_id}`,
      }, () => fetchFood())
      .subscribe()

    // Realtime: results
    const resultsChannel = supabase
      .channel('results-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results' }, () => fetchResults())
      .subscribe()

    // Realtime: event config
    const configChannel = supabase
      .channel('config-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'event_config' }, () => fetchConfig())
      .subscribe()

    return () => {
      supabase.removeChannel(claimsChannel)
      supabase.removeChannel(resultsChannel)
      supabase.removeChannel(configChannel)
    }
  }, [])

  function claimCount(itemId) {
    return claims.filter(c => c.item_id === itemId).length
  }

  function logout() {
    sessionStorage.removeItem('badminton_guest')
    nav('/')
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading your dashboard..." />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-dark-bg flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <header className="px-4 pt-safe pt-4 pb-3 border-b border-dark-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest">Welcome back</p>
            <h1 className="font-black text-xl">{guest.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge bg-court/20 text-court border border-court/30">{guest.external_id}</span>
            <button onClick={logout} className="text-gray-500 text-xs hover:text-white p-1">
              Exit
            </button>
          </div>
        </div>
        {/* Category badge */}
        <span className={`badge mt-1 ${guest.role === 'athlete' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>
          {guest.category}
        </span>
      </header>

      {/* Announcement */}
      <div className="px-4 pt-3">
        <AnnouncementBanner />
      </div>

      {/* Scan button (always visible when on food tab) */}
      {tab === 'food' && (
        <div className="px-4 pt-3">
          <button
            onClick={() => nav('/guest/scan')}
            className="w-full btn-primary flex items-center justify-center gap-2 text-base"
          >
            <span className="text-xl">📷</span>
            Scan Food QR Code
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-dark-border mt-3">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === t.id
                ? 'text-court border-b-2 border-court'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4 space-y-3 pb-8">
        {tab === 'food' && (
          <FoodTab foodItems={foodItems} claimCount={claimCount} />
        )}
        {tab === 'results' && (
          <ResultsTab results={results} motm={motm} />
        )}
        {tab === 'seating' && (
          <SeatingTab url={seatingUrl} />
        )}
      </div>
    </div>
  )
}

function FoodTab({ foodItems, claimCount }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {foodItems.map(item => {
        const meta = FOOD_META[item.id] || { name: item.name, emoji: '🍽️', gradient: 'from-gray-600 to-gray-400' }
        const claimed = claimCount(item.id)
        const full = claimed >= item.quota
        return (
          <div
            key={item.id}
            className={`card relative overflow-hidden transition-all ${full ? 'opacity-60' : ''}`}
          >
            <div className={`absolute inset-0 opacity-5 bg-gradient-to-br ${meta.gradient}`} />
            <div className="relative space-y-2">
              <div className="text-3xl">{meta.emoji}</div>
              <p className="font-bold text-sm leading-tight">{meta.name}</p>
              {/* Progress bar */}
              <div className="h-1.5 bg-dark-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${full ? 'bg-red-500' : 'bg-court'}`}
                  style={{ width: `${Math.min((claimed / item.quota) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                {claimed}/{item.quota} claimed
              </p>
              {full && (
                <span className="text-xs font-bold text-red-400">CLAIMED ✓</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ResultsTab({ results, motm }) {
  return (
    <div className="space-y-4">
      {/* MOTM */}
      {motm.name && (
        <div className="card bg-gradient-to-br from-shuttle/20 to-dark-card border-shuttle/30 space-y-3">
          <p className="text-shuttle font-black text-xs uppercase tracking-widest">⭐ Man of the Match</p>
          <div className="flex items-center gap-3">
            {motm.image && (
              <img
                src={motm.image}
                alt={motm.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-shuttle"
              />
            )}
            <div>
              <p className="font-black text-xl">{motm.name}</p>
              <p className="text-shuttle text-sm">{motm.team}</p>
            </div>
          </div>
        </div>
      )}

      {/* Standings */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border">
          <h3 className="font-bold">🏆 Standings</h3>
        </div>
        {results.length === 0 ? (
          <p className="p-4 text-gray-500 text-sm">Results not yet available.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase">
                <th className="text-left px-4 py-2">#</th>
                <th className="text-left px-4 py-2">Team</th>
                <th className="text-center px-3 py-2">W</th>
                <th className="text-center px-3 py-2">L</th>
                <th className="text-center px-3 py-2">Pts</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.id} className={`border-t border-dark-border ${i === 0 ? 'text-shuttle font-bold' : ''}`}>
                  <td className="px-4 py-3">{r.rank}</td>
                  <td className="px-4 py-3 font-medium">{r.team}</td>
                  <td className="px-3 py-3 text-center text-court">{r.win}</td>
                  <td className="px-3 py-3 text-center text-red-400">{r.lose}</td>
                  <td className="px-3 py-3 text-center font-bold">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function SeatingTab({ url }) {
  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-4xl mb-3">🗺️</div>
        <p className="text-gray-400">Seating map not yet uploaded.</p>
        <p className="text-gray-500 text-sm mt-1">Check back soon!</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl overflow-hidden border border-dark-border">
      <img
        src={url}
        alt="Seating Map"
        className="w-full h-auto"
        style={{ touchAction: 'pinch-zoom' }}
      />
    </div>
  )
}
