import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabase'
import { FOOD_META } from '../lib/foodMeta'

const HIDDEN_FOOD_IDS = new Set(['hydration', 'soft_drink', 'water'])
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner'

export default function FoodPage() {
  const nav = useNavigate()
  const guest = JSON.parse(sessionStorage.getItem('badminton_guest') || '{}')
  // Excom members get unlimited food — never capped at the per-item quota.
  const isUnlimited = guest.role === 'Excom'
  const [foodItems, setFoodItems] = useState([])
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [cameraError, setCameraError] = useState('')
  // Step 2: verification — { itemId, meta, item }
  const [pendingClaim, setPendingClaim] = useState(null)
  const [claimQty, setClaimQty] = useState(1)
  const [confirming, setConfirming] = useState(false)
  // Step 3: success page — { itemId, meta, qty }
  const [claimedItem, setClaimedItem] = useState(null)

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
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'food_claims',
        filter: `attendee_external_id=eq.${guest.external_id}`,
      }, fetchData)
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [])

  // Initialize scanner only AFTER the modal div is in the DOM
  useEffect(() => {
    if (!scanning) return

    let qr = null
    let stopped = false

    async function init() {
      try {
        qr = new Html5Qrcode('food-qr-reader')
        scannerRef.current = qr
        await qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (text) => {
            if (stopped) return
            handleScanRef.current(text)
          },
          () => {}
        )
      } catch {
        if (!stopped) {
          setCameraError('Camera access denied. Please allow camera permissions.')
          setScanning(false)
        }
      }
    }

    init()

    return () => {
      stopped = true
      try { qr?.stop() } catch {}
      scannerRef.current = null
    }
  }, [scanning])

  const handleScanRef = useRef(null)
  handleScanRef.current = async function handleScan(text) {
    if (processingRef.current) return
    processingRef.current = true

    // Stop camera, move to verification step
    try { if (scannerRef.current?.isScanning) await scannerRef.current.stop() } catch {}
    scannerRef.current = null
    setScanning(false)

    if (!text.startsWith('FOOD:')) {
      toast.error('Invalid QR code. Scan a food station QR.')
      processingRef.current = false
      return
    }

    const itemId = text.replace('FOOD:', '').trim()
    const meta = FOOD_META[itemId] || { name: itemId, emoji: '🍽️' }
    const item = foodItems.find(f => f.id === itemId || String(f.id) === itemId)

    setClaimQty(1)
    setPendingClaim({ itemId, meta, item })
  }

  async function confirmClaim() {
    if (!pendingClaim) return
    setConfirming(true)
    const { itemId, meta } = pendingClaim
    let successCount = 0

    try {
      for (let i = 0; i < claimQty; i++) {
        const { data, error } = await supabase.rpc('claim_food', {
          p_attendee_external_id: guest.external_id,
          p_item_id: itemId,
        })
        if (error) throw error
        if (data.success) {
          successCount++
        } else {
          // quota hit mid-loop — stop early
          break
        }
      }

      setPendingClaim(null)
      if (successCount > 0) {
        setClaimedItem({ itemId, meta, qty: successCount })
        fetchData()
      } else {
        toast.error(`You've already claimed all ${meta.name}(s).`)
        processingRef.current = false
      }
    } catch {
      toast.error('Server error. Try again.')
      setPendingClaim(null)
      processingRef.current = false
    } finally {
      setConfirming(false)
    }
  }

  function cancelVerification() {
    setPendingClaim(null)
    processingRef.current = false
  }

  function startScanner() {
    setCameraError('')
    processingRef.current = false
    setScanning(true)
  }

  async function stopScanner() {
    try { if (scannerRef.current?.isScanning) await scannerRef.current.stop() } catch {}
    scannerRef.current = null
    setScanning(false)
  }

  function claimCount(itemId) {
    return claims.filter(c => c.item_id === itemId).length
  }

  if (loading) {
    return <div className="min-h-dvh flex items-center justify-center bg-gray-50"><LoadingSpinner size="lg" /></div>
  }

  // Step 3: Success page
  if (claimedItem) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-gray-50 p-6 text-center max-w-lg mx-auto">
        <div className="space-y-6 w-full">
          {/* Success icon */}
          <div className="relative mx-auto w-32 h-32">
            <div className="w-32 h-32 rounded-full bg-green-100 flex items-center justify-center text-6xl animate-[scale-in_0.3s_ease-out]">
              {claimedItem.meta.emoji || '🍽️'}
            </div>
            <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white text-xl font-black shadow-md">
              ✓
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-black text-gray-900">Claimed!</h2>
            <p className="text-xl font-bold text-gray-700">{claimedItem.meta.name}</p>
            {claimedItem.qty > 1 && (
              <div className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full text-sm">
                × {claimedItem.qty}
              </div>
            )}
            <p className="text-sm text-gray-400">Claimed for {guest.name}</p>
          </div>

          {/* Remaining coupons summary */}
          <div className="card w-full text-left space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Your coupons</p>
            {foodItems.filter(item => !HIDDEN_FOOD_IDS.has(item.id)).map(item => {
              const meta = FOOD_META[item.id] || { name: item.name, emoji: '🍽️' }
              const claimed = claimCount(item.id) + (item.id === claimedItem.itemId || String(item.id) === claimedItem.itemId ? 1 : 0)
              const full = !isUnlimited && claimed >= item.quota
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center">{meta.emoji}</span>
                  <span className={`flex-1 text-sm font-medium ${full ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                    {meta.name}
                  </span>
                  {full
                    ? <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Done</span>
                    : <span className="text-xs text-gray-400">{isUnlimited ? `${claimed} ✕` : `${claimed}/${item.quota}`}</span>
                  }
                </div>
              )
            })}
          </div>

          <div className="w-full space-y-3 pt-2">
            <button
              onClick={() => { setClaimedItem(null); processingRef.current = false }}
              className="btn-primary w-full py-4 text-base font-bold"
            >
              Claim another coupon
            </button>
            <button
              onClick={() => nav('/guest')}
              className="w-full text-gray-400 text-sm py-2 hover:text-gray-600"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    )
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
        {foodItems.filter(item => !HIDDEN_FOOD_IDS.has(item.id)).map(item => {
          const meta = FOOD_META[item.id] || { name: item.name, emoji: '🍽️' }
          const claimed = claimCount(item.id)
          const full = !isUnlimited && claimed >= item.quota

          return (
            <div key={item.id} className={`card flex items-center gap-4 ${full ? 'opacity-70' : ''}`}>
              <div className="text-2xl w-8 text-center shrink-0">{meta.emoji}</div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-gray-900 ${full ? 'line-through text-gray-400' : ''}`}>
                  {meta.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isUnlimited
                    ? `Unlimited · Claimed: ${claimed}`
                    : `Quota: ${item.quota} · Claimed: ${claimed}/${item.quota}`}
                </p>
                {!isUnlimited && (
                  <div className="flex gap-1 mt-1.5">
                    {Array.from({ length: item.quota }).map((_, i) => (
                      <span
                        key={i}
                        className={`w-2.5 h-2.5 rounded-full ${i < claimed ? 'bg-green-500' : 'bg-gray-200'}`}
                      />
                    ))}
                  </div>
                )}
              </div>
              {full ? (
                <div className="flex items-center gap-1 text-green-600 text-sm font-bold whitespace-nowrap">
                  ✓ CLAIMED
                </div>
              ) : (
                <button
                  onClick={startScanner}
                  className="flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap active:scale-95 transition-all"
                >
                  📷 Scan QR
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Step 1: Scanner modal */}
      {scanning && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-black/80">
            <h3 className="text-white font-bold">Scan food station QR</h3>
            <button onClick={stopScanner} className="text-white/70 text-2xl leading-none">×</button>
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

      {/* Step 2: Verification modal */}
      {pendingClaim && (() => {
        const already = claimCount(pendingClaim.itemId)
        const remaining = isUnlimited ? 99 : (pendingClaim.item ? pendingClaim.item.quota - already : 1)
        return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl">
            {/* Item preview */}
            <div className="flex flex-col items-center gap-3 pt-2">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-5xl">
                {pendingClaim.meta.emoji || '🍽️'}
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Confirm Claim</p>
                <h3 className="text-xl font-black text-gray-900">{pendingClaim.meta.name}</h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  {isUnlimited ? 'Unlimited' : `${remaining} left`}
                </p>
              </div>
            </div>

            {/* Quantity picker */}
            <div className="bg-gray-50 rounded-2xl px-4 py-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-3">How many to claim</p>
              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={() => setClaimQty(q => Math.max(1, q - 1))}
                  disabled={claimQty <= 1}
                  className="w-11 h-11 rounded-full border-2 border-gray-200 text-2xl font-bold text-gray-500 hover:border-primary hover:text-primary disabled:opacity-30 transition-all active:scale-90"
                >
                  −
                </button>
                <div className="text-center min-w-[3rem]">
                  <span className="text-4xl font-black text-gray-900">{claimQty}</span>
                  <p className="text-xs text-gray-400 mt-0.5">qty</p>
                </div>
                <button
                  onClick={() => setClaimQty(q => Math.min(remaining, q + 1))}
                  disabled={claimQty >= remaining}
                  className="w-11 h-11 rounded-full border-2 border-primary text-2xl font-bold text-primary hover:bg-primary hover:text-white disabled:opacity-30 transition-all active:scale-90"
                >
                  +
                </button>
              </div>
              {remaining > 1 && (
                <div className="flex justify-center gap-2 mt-3">
                  {Array.from({ length: remaining }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setClaimQty(i + 1)}
                      className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                        claimQty === i + 1
                          ? 'bg-primary text-white'
                          : 'bg-white border border-gray-200 text-gray-500 hover:border-primary'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Name confirmation */}
            <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-black text-sm shrink-0">
                {guest.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{guest.name}</p>
                <p className="text-xs text-gray-400">{guest.company || guest.role}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={cancelVerification}
                disabled={confirming}
                className="py-3 rounded-2xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 disabled:opacity-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmClaim}
                disabled={confirming}
                className="py-3 rounded-2xl bg-primary text-white font-bold text-sm active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {confirming
                ? <LoadingSpinner size="sm" />
                : `✓ Confirm ${claimQty > 1 ? `× ${claimQty}` : ''}`}
              </button>
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}
