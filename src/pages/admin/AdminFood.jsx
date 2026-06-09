import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { FOOD_META } from '../../lib/foodMeta'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function AdminFood() {
  const [items, setItems] = useState([])
  const [claimsMap, setClaimsMap] = useState({})
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
    for (const c of claims || []) map[c.item_id] = (map[c.item_id] || 0) + 1
    setClaimsMap(map)
  }

  useEffect(() => {
    fetchData().finally(() => setLoading(false))
    const ch = supabase.channel('food-admin')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'food_claims' }, fetchData)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  if (loading) return <div className="flex justify-center pt-12"><LoadingSpinner size="lg" /></div>

  const totalClaims = Object.values(claimsMap).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="font-black text-xl text-gray-900">Food Monitor</h1>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-gray-400 font-semibold">LIVE</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center">
          <p className="text-2xl font-black text-primary">{totalClaims}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total Claims</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-black text-amber-500">{attendeeCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">Checked-in Guests</p>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <ul className="divide-y divide-gray-100">
          {items.map(item => {
            const meta = FOOD_META[item.id] || { emoji: '🍽️', name: item.name }
            const claimed = claimsMap[item.id] || 0
            const maxClaims = attendeeCount * item.quota
            const pct = maxClaims > 0 ? Math.round((claimed / maxClaims) * 100) : 0

            return (
              <li key={item.id} className="px-4 py-3.5 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900">{meta.emoji} {meta.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Quota {item.quota}/person · {claimed} people claimed
                  </p>
                  {maxClaims > 0 && (
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5 w-24">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  )}
                </div>
                <p className="text-2xl font-black text-gray-900 ml-4">{claimed}</p>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
