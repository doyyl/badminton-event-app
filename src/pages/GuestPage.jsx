import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchSchedule, findRowByEmail } from '../lib/googleSheet'
import AnnouncementBanner from '../components/AnnouncementBanner'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

export default function GuestPage() {
  const nav = useNavigate()
  const guest = JSON.parse(sessionStorage.getItem('badminton_guest') || '{}')
  const [claims, setClaims] = useState([])
  const [foodItems, setFoodItems] = useState([])
  const [results, setResults] = useState([])
  const [motm, setMotm] = useState({})
  const [seatingUrl, setSeatingUrl] = useState('')
  const [courtMatch, setCourtMatch] = useState(null)
  const [schedule, setSchedule] = useState([])
  const [sheetCourt, setSheetCourt] = useState(null) // { matchNo, courtNum, courtRaw, round, category, time }
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('home') // 'home' | 'results' | 'seating' | 'court'
  const scheduleTimerRef = useRef(null)

  const fetchFood = useCallback(async () => {
    const [{ data: items }, { data: myClaims }] = await Promise.all([
      supabase.from('food_items').select('*').order('id'),
      supabase.from('food_claims').select('item_id').eq('attendee_external_id', guest.external_id),
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

  const fetchCourtMatch = useCallback(async () => {
    if (!guest.external_id) return
    const { data } = await supabase
      .from('matches')
      .select('*')
      .or(`player1_external_id.eq.${guest.external_id},player2_external_id.eq.${guest.external_id}`)
      .in('status', ['scheduled', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setCourtMatch(data)
  }, [guest.external_id])

  const loadSchedule = useCallback(async () => {
    try {
      const rows = await fetchSchedule()
      setSchedule(rows)
      // Match by email — works once organiser adds an email column to the sheet
      const found = findRowByEmail(rows, guest.email)
      if (found?.courtNum) {
        setSheetCourt(found)
        // Notify if a court was just assigned via the sheet
        setSheetCourt(prev => {
          if (!prev || prev.courtNum !== found.courtNum) {
            toast(`🏟️ คุณถูกกำหนดให้เล่นที่ ${found.courtRaw}! (Match ${found.matchNo})`, { duration: 6000 })
          }
          return found
        })
      } else {
        setSheetCourt(null)
      }
    } catch {
      // sheet fetch failures are non-critical
    }
  }, [guest.email])

  useEffect(() => {
    if (!guest.external_id) { nav('/'); return }
    Promise.all([fetchFood(), fetchResults(), fetchConfig(), fetchCourtMatch(), loadSchedule()]).finally(() => setLoading(false))

    // Poll Google Sheet every 60 s
    scheduleTimerRef.current = setInterval(loadSchedule, 60_000)

    const claimsChannel = supabase.channel('my-claims')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'food_claims', filter: `attendee_external_id=eq.${guest.external_id}` }, () => fetchFood())
      .subscribe()

    const resultsChannel = supabase.channel('results-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results' }, () => fetchResults())
      .subscribe()

    const configChannel = supabase.channel('config-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'event_config' }, () => fetchConfig())
      .subscribe()

    const matchChannel = supabase.channel('matches-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, payload => {
        const m = payload.new
        if (!m) return
        if (m.player1_external_id === guest.external_id || m.player2_external_id === guest.external_id) {
          fetchCourtMatch()
          if (payload.eventType === 'INSERT') {
            toast(`🏟️ You're assigned to Court ${m.court_id}! Head there now.`, { duration: 6000 })
          }
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(claimsChannel)
      supabase.removeChannel(resultsChannel)
      supabase.removeChannel(configChannel)
      supabase.removeChannel(matchChannel)
      clearInterval(scheduleTimerRef.current)
    }
  }, [])

  const allClaimed = foodItems.length > 0 && foodItems.every(item => {
    const count = claims.filter(c => c.item_id === item.id).length
    return count >= item.quota
  })
  const foodBadge = allClaimed ? 'DONE' : 'READY'

  function logout() {
    sessionStorage.removeItem('badminton_guest')
    nav('/')
  }

  if (loading) {
    return <div className="min-h-dvh flex items-center justify-center bg-gray-50"><LoadingSpinner size="lg" /></div>
  }

  // Sub-views
  if (view === 'results') {
    return <ResultsView results={results} motm={motm} schedule={schedule} onBack={() => setView('home')} />
  }
  if (view === 'seating') {
    return <SeatingView url={seatingUrl} onBack={() => setView('home')} />
  }
  if (view === 'court') {
    return <CourtView match={courtMatch} sheetCourt={sheetCourt} guestId={guest.external_id} onBack={() => setView('home')} nav={nav} />
  }

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50 max-w-lg mx-auto">
      {/* Hero profile section */}
      <div className="bg-gradient-to-b from-slate-400 to-slate-300 px-6 pt-10 pb-8 text-center">
        <div className="inline-flex items-center bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
          {guest.company || 'SMASH'}
        </div>
        <div className="w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center text-3xl font-black text-slate-600 mx-auto mb-3">
          {guest.name?.charAt(0)?.toUpperCase()}
        </div>
        <h1 className="text-2xl font-black text-white">{guest.name}</h1>
        <p className="text-white/70 text-sm">{guest.company}</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded-full uppercase">
            {guest.category}
          </span>
          <span className="text-white/40">·</span>
          <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded-full uppercase">
            {guest.role}
          </span>
        </div>
        <p className="text-white/50 text-xs mt-3 uppercase tracking-widest">SMASH BADMINTON · TOURNAMENT 2024</p>
      </div>

      {/* Status bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
        <span className="text-success text-sm font-semibold">Checked in ✓</span>
      </div>

      {/* Announcement */}
      <div className="px-4 pt-3">
        <AnnouncementBanner />
      </div>

      {/* Navigation cards */}
      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Court assignment (athletes only) */}
        {guest.role === 'athlete' && (
          <div>
            <p className="section-label">Court</p>
            <button onClick={() => setView('court')} className="nav-item w-full">
              <div className="flex items-center gap-3">
                <span className="text-xl">🏟️</span>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">My Court</p>
                  {courtMatch ? (
                    <p className="text-xs text-primary">Court {courtMatch.court_id} assigned</p>
                  ) : (
                    <p className="text-xs text-gray-400">No match assigned yet</p>
                  )}
                </div>
              </div>
              <span className="text-gray-400">›</span>
            </button>
          </div>
        )}

        {/* Event info */}
        <div>
          <p className="section-label">Event Info</p>
          <div className="space-y-2">
            <button onClick={() => setView('results')} className="nav-item w-full">
              <div className="flex items-center gap-3">
                <span className="text-xl">🏆</span>
                <span className="font-semibold text-gray-800">Results & scoreboard</span>
              </div>
              <span className="text-gray-400">›</span>
            </button>
            <button onClick={() => setView('seating')} className="nav-item w-full">
              <div className="flex items-center gap-3">
                <span className="text-xl">📍</span>
                <span className="font-semibold text-gray-800">Seating map</span>
              </div>
              <span className="text-gray-400">›</span>
            </button>
          </div>
        </div>

        {/* Food & drinks */}
        <div>
          <p className="section-label">Food & Drinks</p>
          <button
            onClick={() => nav('/guest/food')}
            className={`nav-item w-full ${!allClaimed ? 'border-success' : ''}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🍽️</span>
              <span className="font-semibold text-gray-800">My food coupons</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`badge ${allClaimed ? 'bg-gray-100 text-gray-500' : 'bg-success text-white'} font-bold text-xs px-2 py-1`}>
                {foodBadge}
              </span>
              <span className="text-gray-400">›</span>
            </div>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-6 text-center space-y-1">
        <p className="text-xs text-gray-400">Pass ID · {guest.external_id}</p>
        <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 underline">
          Exit
        </button>
      </div>
    </div>
  )
}

function ResultsView({ results, motm, schedule, onBack }) {
  const [tab, setTab] = useState('schedule') // 'schedule' | 'standings'

  const live = schedule.filter(r => r.status === 'live')
  const done = schedule.filter(r => r.status === 'done')
  const upcoming = schedule.filter(r => r.status === 'upcoming')

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50 max-w-lg mx-auto">
      <header className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-200 sticky top-0 z-10">
        <button onClick={onBack} className="text-gray-500">←</button>
        <h2 className="font-bold text-gray-900 flex-1">Results & Scoreboard</h2>
        {live.length > 0 && (
          <span className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
            {live.length} LIVE
          </span>
        )}
      </header>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-200">
        {['schedule', 'standings'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === t
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {t === 'schedule' ? '📋 ตารางแข่ง' : '🏆 อันดับ'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {tab === 'schedule' && (
          <div className="p-4 space-y-4">
            {schedule.length === 0 && (
              <div className="flex flex-col items-center py-16 text-center gap-3">
                <div className="text-4xl">📋</div>
                <p className="text-gray-400 text-sm">ยังไม่มีข้อมูลตารางแข่ง</p>
              </div>
            )}

            {live.length > 0 && (
              <ScheduleGroup label="🔴 กำลังแข่งขัน" rows={live} />
            )}
            {upcoming.length > 0 && (
              <ScheduleGroup label="⏰ รอแข่ง" rows={upcoming} />
            )}
            {done.length > 0 && (
              <ScheduleGroup label="✅ แข่งจบแล้ว" rows={done} collapsed />
            )}
          </div>
        )}

        {tab === 'standings' && (
          <div className="p-4 space-y-4">
            {motm?.name && (
              <div className="card bg-amber-50 border-amber-200 space-y-3">
                <p className="text-amber-600 font-black text-xs uppercase tracking-widest">⭐ Man of the Match</p>
                <div className="flex items-center gap-3">
                  {motm.image && <img src={motm.image} alt={motm.name} className="w-14 h-14 rounded-full object-cover border-2 border-amber-400" />}
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
                <p className="p-4 text-gray-400 text-sm">Results not yet available.</p>
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
                      <tr key={r.id} className={`border-t border-gray-100 ${i === 0 ? 'font-bold' : ''}`}>
                        <td className="px-4 py-3 text-gray-500">{r.rank}</td>
                        <td className="px-4 py-3 text-gray-900">{r.team}</td>
                        <td className="px-3 py-3 text-center text-green-600">{r.win}</td>
                        <td className="px-3 py-3 text-center text-primary">{r.lose}</td>
                        <td className="px-3 py-3 text-center font-bold text-gray-900">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ScheduleGroup({ label, rows, collapsed = false }) {
  const [open, setOpen] = useState(!collapsed)
  return (
    <div className="card p-0 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50"
      >
        <span className="font-bold text-sm text-gray-800">{label}</span>
        <span className="text-gray-400 text-xs">{rows.length} แมตช์ {open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div>
          {rows.map((r, i) => (
            <div
              key={r.matchNo}
              className={`flex items-center gap-3 px-4 py-3 text-sm ${i > 0 ? 'border-t border-gray-100' : ''}`}
            >
              <span className="font-mono text-gray-400 text-xs w-8 shrink-0">#{r.matchNo}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{r.round}</p>
                <p className="text-xs text-gray-400">{r.category} · {r.time}</p>
              </div>
              {r.courtRaw && (
                <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-lg shrink-0">
                  {r.courtRaw}
                </span>
              )}
              {r.status === 'live' && (
                <span className="flex items-center gap-1 text-xs font-bold text-primary shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                  LIVE
                </span>
              )}
              {r.status === 'done' && (
                <span className="text-xs font-bold text-green-600 shrink-0">✓</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SeatingView({ url, onBack }) {
  return (
    <div className="min-h-dvh flex flex-col bg-gray-50 max-w-lg mx-auto">
      <header className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-200">
        <button onClick={onBack} className="text-gray-500">←</button>
        <h2 className="font-bold text-gray-900">Seating Map</h2>
      </header>
      <div className="flex-1 p-4">
        {url ? (
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
            <img src={url} alt="Seating Map" className="w-full h-auto" style={{ touchAction: 'pinch-zoom' }} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-3">🗺️</div>
            <p className="text-gray-500">Seating map not yet uploaded.</p>
            <p className="text-gray-400 text-sm mt-1">Check back soon!</p>
          </div>
        )}
      </div>
    </div>
  )
}

function CourtView({ match, sheetCourt, guestId, onBack, nav }) {
  // Show sheet-based court if no Supabase match yet
  if (!match && sheetCourt?.courtNum) {
    return (
      <div className="min-h-dvh flex flex-col bg-gray-50 max-w-lg mx-auto">
        <header className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-200">
          <button onClick={onBack} className="text-gray-500">←</button>
          <h2 className="font-bold text-gray-900">My Court</h2>
        </header>
        <div className="p-4 space-y-4">
          <div className="card bg-primary/5 border-primary/20 text-center py-6">
            <p className="text-xs text-primary font-bold uppercase tracking-widest mb-1">สนามของคุณ</p>
            <p className="text-6xl font-black text-gray-900">{sheetCourt.courtNum}</p>
            <p className="text-sm text-gray-500 mt-2">{sheetCourt.courtRaw}</p>
          </div>
          <div className="card space-y-2">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">รายละเอียดแมตช์</p>
            <p className="font-semibold text-gray-900">Match #{sheetCourt.matchNo} · {sheetCourt.round}</p>
            <p className="text-sm text-gray-500">{sheetCourt.category} · {sheetCourt.time}</p>
          </div>
          <button
            onClick={() => nav(`/court/${sheetCourt.courtNum}`)}
            className="btn-primary w-full py-4 text-base font-bold"
          >
            📍 Check In at {sheetCourt.courtRaw}
          </button>
        </div>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="min-h-dvh flex flex-col bg-gray-50 max-w-lg mx-auto">
        <header className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-200">
          <button onClick={onBack} className="text-gray-500">←</button>
          <h2 className="font-bold text-gray-900">My Court</h2>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
          <div className="text-5xl">🏟️</div>
          <p className="font-bold text-lg text-gray-900">No match assigned yet</p>
          <p className="text-gray-400 text-sm">You'll get a notification when it's your turn.</p>
        </div>
      </div>
    )
  }

  const isP1 = match.player1_external_id === guestId
  const myScore = isP1 ? match.score1 : match.score2
  const oppScore = isP1 ? match.score2 : match.score1
  const oppName = isP1 ? match.player2_name : match.player1_name

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50 max-w-lg mx-auto">
      <header className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-200">
        <button onClick={onBack} className="text-gray-500">←</button>
        <h2 className="font-bold text-gray-900">My Court</h2>
      </header>
      <div className="p-4 space-y-4">
        <div className="card bg-primary/5 border-primary/20 text-center py-6">
          <p className="text-xs text-primary font-bold uppercase tracking-widest mb-1">Your Court</p>
          <p className="text-6xl font-black text-gray-900">{match.court_id}</p>
          <p className={`text-xs font-semibold mt-2 ${match.status === 'active' ? 'text-success' : 'text-amber-500'}`}>
            {match.status === 'active' ? '● Match in progress' : '◌ Waiting to start'}
          </p>
        </div>

        {match.status === 'active' && (
          <div className="card">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-4">Live Score</p>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 text-center">
                <p className="font-bold text-sm text-gray-700">You</p>
                <p className="text-5xl font-black text-primary mt-1">{myScore}</p>
              </div>
              <div className="text-gray-300 font-black text-2xl">VS</div>
              <div className="flex-1 text-center">
                <p className="font-bold text-sm text-gray-700">{oppName}</p>
                <p className="text-5xl font-black text-amber-500 mt-1">{oppScore}</p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => nav(`/court/${match.court_id}`)}
          className="btn-primary w-full"
        >
          📍 Check In at Court {match.court_id}
        </button>
      </div>
    </div>
  )
}
