import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner'

export default function CourtCheckinPage() {
  const { courtId } = useParams()
  const nav = useNavigate()
  const guest = JSON.parse(sessionStorage.getItem('badminton_guest') || '{}')
  const courtNum = parseInt(courtId)

  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!guest.external_id) {
      sessionStorage.setItem('court_redirect', `/court/${courtId}`)
      nav('/')
      return
    }
    fetchMatch()
  }, [courtId])

  async function fetchMatch() {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('court_id', courtNum)
      .in('status', ['scheduled', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setMatch(data)
    setLoading(false)
  }

  async function handleCheckin() {
    setChecking(true)
    try {
      await supabase.from('court_checkins').insert({
        court_id: courtNum,
        attendee_external_id: guest.external_id,
        match_id: match?.id || null,
      })

      if (match?.status === 'scheduled') {
        await supabase
          .from('matches')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', match.id)
      }

      setDone(true)
      toast.success(`Checked in to Court ${courtId}!`)
    } catch (err) {
      if (err?.message?.includes('duplicate') || err?.code === '23505') {
        setDone(true)
      } else {
        toast.error('Check-in failed. Try again.')
      }
    } finally {
      setChecking(false)
    }
  }

  const opponent = match
    ? (match.player1_external_id === guest.external_id ? match.player2_name : match.player1_name)
    : null

  if (loading) {
    return <div className="min-h-dvh flex items-center justify-center bg-gray-50"><LoadingSpinner size="lg" /></div>
  }

  if (done) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-gray-50 p-6 text-center space-y-6">
        <div className="w-28 h-28 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center text-6xl">
          🏸
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-primary">You're In!</h2>
          <p className="text-xl font-bold">Court {courtId}</p>
          {opponent && <p className="text-gray-400 text-sm">vs. <span className="text-white">{opponent}</span></p>}
          <p className="text-gray-500 text-sm mt-2">The referee will start the match shortly.</p>
        </div>
        <button onClick={() => nav('/guest')} className="btn-primary w-full max-w-xs">
          Go to My Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-gray-50 p-6 text-center space-y-6 max-w-sm mx-auto">
      <div>
        <div className="text-6xl mb-3">🏟️</div>
        <h1 className="font-black text-4xl">Court {courtId}</h1>
        <p className="text-gray-400 mt-2">Hi, <span className="text-white font-bold">{guest.name}</span></p>
      </div>

      {match ? (
        <div className="card w-full space-y-3">
          <p className="text-xs text-primary font-bold uppercase tracking-widest">Your Match</p>
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-sm flex-1 text-left">{match.player1_name}</span>
            <span className="text-gray-500 font-black text-xs px-2">VS</span>
            <span className="font-bold text-sm flex-1 text-right">{match.player2_name}</span>
          </div>
          <p className="text-xs text-gray-500">Tap below to confirm your arrival</p>
        </div>
      ) : (
        <div className="card w-full">
          <p className="text-gray-400 text-sm">No scheduled match found for this court yet.</p>
          <p className="text-gray-500 text-xs mt-1">You can still check in and wait.</p>
        </div>
      )}

      <button
        onClick={handleCheckin}
        disabled={checking}
        className="btn-primary w-full py-4 text-lg font-black"
      >
        {checking ? <LoadingSpinner size="sm" /> : '✅ Check In to Court'}
      </button>

      <button onClick={() => nav('/guest')} className="text-gray-500 text-sm hover:text-white">
        ← Go back
      </button>
    </div>
  )
}
