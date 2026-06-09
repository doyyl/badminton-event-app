import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabase'
import { FOOD_META } from '../lib/foodMeta'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner'

export default function FoodPage() {
  const nav = useNavigate()
  const guest = JSON.parse(sessionStorage.getItem('badminton_guest') || '{}')
  const [foodItems, setFoodItems] = useState([])
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const scannerRef = useRef(null)
  const processingRef = useRef(false)

  const fetchData = useCallback(async () => {
    const [{ data: items }, { data: myClaims }] = await Promise.all([
      supabase.from('food_items').select('*').order('id'),
      supabase.from('food_claims').select('item_id').eq('attendee_external_id', guest.external_id),
    ])
    setFoodItems(items || [])
    setClaims(myClaims || [])
  }, [guest.external_id])

  useEffect(() => {
    if (!guest.external_id) { nav('/'); return }
    fetchData().finally(() => setLoading(false))

    const ch = supabase.channel('food-page-claims')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'food_claims', filter: `attendee_external_id=eq.${guest.external_id}` }, fetchData)
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [])

  async function startScanner() {
    setCameraError('')
    setScanning(true)
    processingRef.current = false
    try {
      const qr = new Html5Qrcode('food-qr-reader')
      scannerRef.current = qr
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        handleScan,
        () => {}
      )
    } catch {
      setCameraError('Camera access denied. Please allow camera permissions.')
      setScanning(false)
    }
  }

  async function stopScanner() {
    try {
      if (scannerRef.current?.isScanning) await scannerRef.current.stop()
    } catch {}
    scannerRef.current = null
  }

  async function handleScan(text) {
    if (processingRef.current) return
    processingRef.current = true
    await stopScanner()
    setScanning(false)

    if (!text.startsWith('FOOD:')) {
      toast.error('Invalid QR code. Scan a food station QR.')
      return
    }

    const itemId = text.replace('FOOD:', '').trim()
    const meta = FOOD_META[itemId]

    try {
      const { data, error } = await supabase.rpc('claim_food', {
        p_attendee_external_id: guest.external_id,
        p_item_id: itemId,
      })
      if (error) throw error

      if (data.success) {
        toast.success(`${meta?.name || itemId} claimed! ✓`)
        fetchData()
      } else if (data.error === 'quota_reached') {
        toast.error(`You've already claimed all ${meta?.name || itemId}(s).`)
      } else {
        toast.error(data.error || 'Unknown error')
      }
    } catch {
      toast.error('Server error. Try again.')
    }
  }

  function claimCount(itemId) {
    return claims.filter(c => c.item_id === itemId).length
  }

  if (loading) {
    return <div className="min-h-dvh flex items-center justify-center bg-gray-50"><LoadingSpinner size="lg" /></div>
  }

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50 max-w-lg mx-auto">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => nav('/guest')} className="text-gray-500 font-medium">←</button>
        <div>
          <h2 className="font-bold text-gray-900">My food coupons</h2>
          <p className="text-xs text-gray-400">Scan each station to claim</p>
        </div>
      </header>

      {/* Food list */}
      <div className="flex-1 p-4 space-y-3 pb-8">
        {foodItems.map(item => {
          const meta = FOOD_META[item.id] || { name: item.name, emoji: '🍽️' }
          const claimed = claimCount(item.id)
          const full = claimed >= item.quota

          return (
            <div key={item.id} className={`card flex items-center gap-4 ${full ? 'opacity-70' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-gray-900 ${full ? 'line-through text-gray-400' : ''}`}>
                  {meta.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Quota: {item.quota} · Claimed: {claimed}/{item.quota}
                </p>
                <div className="flex gap-1 mt-1.5">
                  {Array.from({ length: item.quota }).map((_, i) => (
                    <span
                      key={i}
                      className={`w-2.5 h-2.5 rounded-full ${i < claimed ? 'bg-success' : 'bg-gray-200'}`}
                    />
                  ))}
                </div>
              </div>
              {full ? (
                <div className="flex items-center gap-1 text-gray-400 text-sm font-semibold whitespace-nowrap">
                  <span className="text-success">✓</span> CLAIMED
                </div>
              ) : (
                <button
                  onClick={startScanner}
                  className="flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap active:scale-95 transition-all"
                >
                  📷 Scan station QR
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Scanner modal */}
      {scanning && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-black/80">
            <h3 className="text-white font-bold">Scan food station QR</h3>
            <button
              onClick={() => { stopScanner(); setScanning(false) }}
              className="text-white/70 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {cameraError ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
              <div className="text-4xl">📷</div>
              <p className="text-white/70">{cameraError}</p>
              <button onClick={() => window.location.reload()} className="btn-secondary">Reload</button>
            </div>
          ) : (
            <div className="flex-1 relative">
              <div id="food-qr-reader" className="w-full h-full" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="w-56 h-56 border-2 border-white rounded-2xl"
                  style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)' }}
                />
              </div>
              <div className="absolute bottom-12 left-0 right-0 text-center">
                <p className="text-white/70 text-sm">Point at the station's QR code</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
