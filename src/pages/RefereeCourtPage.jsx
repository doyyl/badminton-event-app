import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner'

export default function RefereeCourtPage() {
  const { courtId } = useParams()
  const nav = useNavigate()
  const courtNum = parseInt(courtId)

  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newMatch, setNewMatch] = useState({ p1: '', p2: '', p1Id: '', p2Id: '' })
  const [search, setSearch] = useState({ p1: [], p2: [] })

  useEffect(() => {
    if (!sessionStorage.getItem('badminton_referee')) { nav('/referee'); return }
    fetchMatch()

    const ch = supabase
      .channel(`ref-court-${courtId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `court_id=eq.${courtId}` }, fetchMatch)
      .subscribe()

    return () => supabase.removeChannel(ch)
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

  async function searchPlayers(q, side) {
    if (!q.trim()) { setSearch(s => ({ ...s, [side]: [] })); return }
    const { data } = await supabase
      .from('attendees')
      .select('external_id, name, category')
      .or(`name.ilike.%${q}%,external_id.ilike.%${q}%`)
      .eq('role', 'athlete')
      .limit(5)
    setSearch(s => ({ ...s, [side]: data || [] }))
  }

  async function createMatch() {
    if (!newMatch.p1.trim() || !newMatch.p2.trim()) return
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('matches')
        .insert({
          court_id: courtNum,
          player1_name: newMatch.p1.trim(),
          player2_name: newMatch.p2.trim(),
          player1_external_id: newMatch.p1Id || null,
          player2_external_id: newMatch.p2Id || null,
          score1: 0, score2: 0, status: 'active',
        })
        .select().single()
      if (error) throw error
      setMatch(data)
      setCreating(false)
      setNewMatch({ p1: '', p2: '', p1Id: '', p2Id: '' })
      toast.success('Match started!')
    } catch {
      toast.error('Failed to start match')
    } finally {
      setSaving(false)
    }
  }

  async function updateScore(field, delta) {
    if (!match) return
    const next = Math.max(0, (match[field] || 0) + delta)
    setMatch(m => ({ ...m, [field]: next }))
    await supabase
      .from('matches')
      .update({ [field]: next, updated_at: new Date().toISOString() })
      .eq('id', match.id)
  }

  async function completeMatch(winnerId, winnerName) {
    if (!confirm(`Declare winner: ${winnerName}?`)) return
    setSaving(true)
    try {
      await supabase
        .from('matches')
        .update({ status: 'completed', winner_external_id: winnerId, updated_at: new Date().toISOString() })
        .eq('id', match.id)
      toast.success(`Winner: ${winnerName} 🏆`)
      setMatch(null)
    } catch {
      toast.error('Failed to save result')
    } finally {
      setSaving(false)
    }
  }

  async function cancelMatch() {
    if (!confirm('Cancel this match?')) return
    await supabase.from('matches').update({ status: 'cancelled' }).eq('id', match.id)
    setMatch(null)
    toast('Match cancelled')
  }

  if (loading) {
    return <div className="min-h-dvh flex items-center justify-center bg-gray-50"><LoadingSpinner size="lg" /></div>
  }

  return (
    <div className="min-h-dvh bg-gray-50 p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 py-4 border-b border-gray-200 mb-4">
        <button onClick={() => nav('/referee')} className="text-gray-400 hover:text-white">←</button>
        <div>
          <h1 className="font-black text-2xl">Court {courtId}</h1>
          <p className={`text-xs font-bold ${match?.status === 'active' ? 'text-primary' : match?.status === 'scheduled' ? 'text-yellow-400' : 'text-gray-500'}`}>
            {match?.status === 'active' ? '● MATCH IN PROGRESS' : match?.status === 'scheduled' ? '◌ SCHEDULED' : '○ VACANT'}
          </p>
        </div>
      </div>

      {/* No match */}
      {!match && !creating && (
        <div className="card flex flex-col items-center gap-4 py-12 text-center">
          <span className="text-5xl">🏸</span>
          <p className="text-gray-400">No active match on this court</p>
          <button onClick={() => setCreating(true)} className="btn-primary px-8">+ Start New Match</button>
        </div>
      )}

      {/* Create match form */}
      {creating && (
        <div className="card space-y-4">
          <h2 className="font-bold text-lg">New Match — Court {courtId}</h2>

          <PlayerSearch
            label="Player 1"
            value={newMatch.p1}
            results={search.p1}
            onChange={v => { setNewMatch(m => ({ ...m, p1: v, p1Id: '' })); searchPlayers(v, 'p1') }}
            onSelect={a => { setNewMatch(m => ({ ...m, p1: a.name, p1Id: a.external_id })); setSearch(s => ({ ...s, p1: [] })) }}
          />

          <div className="text-center text-gray-500 font-black text-xl">VS</div>

          <PlayerSearch
            label="Player 2"
            value={newMatch.p2}
            results={search.p2}
            onChange={v => { setNewMatch(m => ({ ...m, p2: v, p2Id: '' })); searchPlayers(v, 'p2') }}
            onSelect={a => { setNewMatch(m => ({ ...m, p2: a.name, p2Id: a.external_id })); setSearch(s => ({ ...s, p2: [] })) }}
          />

          <div className="flex gap-3 pt-2">
            <button onClick={() => setCreating(false)} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={createMatch}
              disabled={!newMatch.p1.trim() || !newMatch.p2.trim() || saving}
              className="btn-primary flex-1"
            >
              {saving ? <LoadingSpinner size="sm" /> : 'Start Match'}
            </button>
          </div>
        </div>
      )}

      {/* Active match scoreboard */}
      {match && (
        <div className="space-y-4">
          <div className="card space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary uppercase tracking-widest">Live Score</span>
              <span className="text-xs text-gray-500">Court {courtId}</span>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <ScorePanel
                name={match.player1_name}
                extId={match.player1_external_id}
                score={match.score1}
                onInc={() => updateScore('score1', 1)}
                onDec={() => updateScore('score1', -1)}
                color="court"
              />
              <ScorePanel
                name={match.player2_name}
                extId={match.player2_external_id}
                score={match.score2}
                onInc={() => updateScore('score2', 1)}
                onDec={() => updateScore('score2', -1)}
                color="shuttle"
              />
            </div>
          </div>

          {/* Declare winner */}
          <div className="card space-y-3">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Declare Winner</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => completeMatch(match.player1_external_id, match.player1_name)}
                disabled={saving}
                className="btn-primary py-3 text-sm font-bold"
              >
                🏆 {match.player1_name}
              </button>
              <button
                onClick={() => completeMatch(match.player2_external_id, match.player2_name)}
                disabled={saving}
                className="bg-amber-500 text-black font-bold py-3 px-4 rounded-xl active:scale-95 transition-all disabled:opacity-50 text-sm"
              >
                🏆 {match.player2_name}
              </button>
            </div>
          </div>

          <button onClick={cancelMatch} className="btn-secondary w-full text-sm text-red-400">
            ✕ Cancel Match
          </button>
        </div>
      )}
    </div>
  )
}

function ScorePanel({ name, extId, score, onInc, onDec, color }) {
  const colorMap = { court: 'text-primary', shuttle: 'text-amber-600' }
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div>
        <p className="font-bold text-sm leading-tight">{name}</p>
        {extId && <p className="text-xs text-gray-500 font-mono">{extId}</p>}
      </div>
      <div className={`text-7xl font-black ${colorMap[color] || 'text-white'}`}>{score}</div>
      <div className="flex gap-2">
        <button
          onClick={onDec}
          className="w-11 h-11 rounded-full border border-gray-200 text-xl font-bold hover:border-red-400 hover:text-red-400 transition-colors"
        >
          −
        </button>
        <button
          onClick={onInc}
          className="w-11 h-11 rounded-full border border-primary text-xl font-bold text-primary hover:bg-primary hover:text-black transition-colors"
        >
          +
        </button>
      </div>
    </div>
  )
}

function PlayerSearch({ label, value, results, onChange, onSelect }) {
  return (
    <div className="relative">
      <label className="label">{label}</label>
      <input
        className="input"
        placeholder="Search name or ID..."
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xl">
          {results.map(a => (
            <button
              key={a.external_id}
              type="button"
              onClick={() => onSelect(a)}
              className="w-full text-left px-4 py-2.5 hover:bg-dark-border flex items-center justify-between text-sm"
            >
              <span className="font-medium">{a.name}</span>
              <span className="text-xs text-gray-500 font-mono">{a.external_id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
