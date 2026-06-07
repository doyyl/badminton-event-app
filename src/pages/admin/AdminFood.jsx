import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { FOOD_META } from '../../lib/foodMeta'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function AdminFood() {
  const [items, setItems] = useState([])
  const [claimsMap, setClaimsMap] = useState({}) // item_id -> count
  const [attendeeCount, setAttendeeCount] = useState(0)
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    const [{ data: foodItems }, { data: claims }, { count }] = await Promise.all([
      supabase.from('food_items').select('*').order('id'),
      supabase.from('food_claims').select('item_id'),
      supabase.from('attendees').select('*', { count: 'exact', head: true }).eq('checked_in', true),
    ])

    setItems(foodItems || [])
    setAttendeeCount(count || 0)

    const map = {}
    for (const c of claims || []) {
      map[c.item_id] = (map[c.item_id] || 0) + 1
    }
    setClaimsMap(map)
  }

  useEffect(() => {
    fetchData().finally(() => setLoading(false))

    const channel = supabase
      .channel('food-admin')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'food_claims' }, fetchData)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  if (loading) return <div className="flex justify-center pt-12"><LoadingSpinner size="lg" /></div>

  const totalClaims = Object.values(claimsMap).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-black text-2xl">Food Monitor</h1>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-court animate-pulse" />
          <span className="text-xs text-gray-400">Live</span>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center">
          <p className="text-2xl font-black text-court">{totalClaims}</p>
          <p className="text-xs text-gray-500">Total Claims</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-black text-shuttle">{attendeeCount}</p>
          <p className="text-xs text-gray-500">Checked-in Guests</p>
        </div>
      </div>

      {/* Per-item breakdown */}
      <div className="space-y-3">
        {items.map(item => {
          const meta = FOOD_META[item.id] || { emoji: '🍽️', name: item.name, gradient: 'from-gray-600 to-gray-400' }
          const claimed = claimsMap[item.id] || 0
          const maxClaims = attendeeCount * item.quota
          const pct = maxClaims > 0 ? Math.round((claimed / maxClaims) * 100) : 0

          return (
            <div key={item.id} className="card space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{meta.emoji}</span>
                  <span className="font-semibold">{meta.name}</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-court">{claimed}</p>
                  <p className="text-xs text-gray-500">/{maxClaims} max</p>
                </div>
              </div>
              <div className="h-2 bg-dark-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${meta.gradient}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Quota per person: {item.quota}</span>
                <span>{pct}% claimed</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* QR Codes for food stations */}
      <div className="card space-y-3">
        <h3 className="font-bold">Food Station QR Values</h3>
        <p className="text-xs text-gray-400">
          Use these values to generate QR codes for each food station (e.g. via qr-code-generator.com)
        </p>
        <div className="grid grid-cols-2 gap-2">
          {items.map(item => (
            <div key={item.id} className="bg-dark-bg border border-dark-border rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">{FOOD_META[item.id]?.emoji} {FOOD_META[item.id]?.name || item.name}</p>
              <p className="font-mono text-xs text-court break-all">FOOD:{item.id}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
