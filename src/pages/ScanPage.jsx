import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabase'
import { FOOD_META } from '../lib/foodMeta'
import toast from 'react-hot-toast'

export default function ScanPage() {
  const nav = useNavigate()
  const guest = JSON.parse(sessionStorage.getItem('badminton_guest') || '{}')
  const scannerRef = useRef(null)
  const processingRef = useRef(false)
  const [status, setStatus] = useState('scanning') // 'scanning' | 'processing' | 'success' | 'error'
  const [result, setResult] = useState(null)
  const [cameraError, setCameraError] = useState('')

  useEffect(() => {
    if (!guest.external_id) { nav('/'); return }
    startScanner()
    return () => stopScanner()
  }, [])

  async function startScanner() {
    try {
      const qr = new Html5Qrcode('qr-reader')
      scannerRef.current = qr
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        handleScan,
        () => {}
      )
    } catch {
      setCameraError('Camera access denied. Please allow camera permissions and reload.')
    }
  }

  async function stopScanner() {
    try {
      if (scannerRef.current?.isScanning) await scannerRef.current.stop()
    } catch {}
  }

  async function handleScan(text) {
    if (processingRef.current) return
    processingRef.current = true
    setStatus('processing')
    await stopScanner()

    if (!text.startsWith('FOOD:')) {
      setStatus('error')
      setResult({ message: 'Invalid QR code. Please scan a food station QR.' })
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
        setStatus('success')
        setResult({
          itemId,
          name: meta?.name || itemId,
          emoji: meta?.emoji || '🍽️',
          claimed: data.claimed,
          quota: data.quota,
          remaining: data.remaining,
        })
      } else if (data.error === 'quota_reached') {
        setStatus('error')
        setResult({
          message: `You've already claimed all ${data.quota} ${meta?.name || itemId}(s).`,
          emoji: meta?.emoji || '🍽️',
        })
      } else {
        setStatus('error')
        setResult({ message: data.error || 'Unknown error.' })
      }
    } catch (err) {
      setStatus('error')
      setResult({ message: 'Server error. Please try again.' })
    }
  }

  function retry() {
    processingRef.current = false
    setStatus('scanning')
    setResult(null)
    setCameraError('')
    startScanner()
  }

  return (
    <div className="min-h-dvh bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-dark-bg">
        <button onClick={() => nav('/guest')} className="text-gray-400 font-medium flex items-center gap-2">
          ← Back
        </button>
        <h2 className="font-bold">Scan Food QR</h2>
        <div className="w-16" />
      </div>

      {/* Scanner area */}
      {status === 'scanning' && !cameraError && (
        <div className="flex-1 relative">
          <div id="qr-reader" className="w-full h-full" />
          {/* Overlay frame */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-60 h-60 border-2 border-court rounded-2xl shadow-lg" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }} />
          </div>
          <div className="absolute bottom-12 left-0 right-0 text-center">
            <p className="text-white/70 text-sm">Point camera at food station QR code</p>
          </div>
        </div>
      )}

      {cameraError && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="text-4xl">📷</div>
          <p className="text-red-400 font-medium">{cameraError}</p>
          <button onClick={() => window.location.reload()} className="btn-secondary">
            Reload Page
          </button>
        </div>
      )}

      {status === 'processing' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-dark-bg">
          <div className="h-12 w-12 border-2 border-dark-border border-t-court rounded-full animate-spin" />
          <p className="text-gray-400">Claiming your item...</p>
        </div>
      )}

      {status === 'success' && result && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-5 bg-dark-bg">
          <div className="w-24 h-24 rounded-full bg-court/20 border-2 border-court flex items-center justify-center text-5xl">
            {result.emoji}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <div className="w-8 h-8 rounded-full bg-court flex items-center justify-center">
                <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-black text-court">Claimed!</h2>
            </div>
            <p className="text-xl font-bold">{result.name}</p>
            <p className="text-gray-400 text-sm">{result.claimed}/{result.quota} used · {result.remaining} remaining</p>
          </div>
          <div className="flex gap-3 w-full">
            {result.remaining > 0 && (
              <button onClick={retry} className="btn-secondary flex-1">
                Scan Another
              </button>
            )}
            <button onClick={() => nav('/guest')} className="btn-primary flex-1">
              Done
            </button>
          </div>
        </div>
      )}

      {status === 'error' && result && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-5 bg-dark-bg">
          <div className="w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-5xl">
            {result.emoji || '❌'}
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-red-400">Oops!</h2>
            <p className="text-gray-300">{result.message}</p>
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={retry} className="btn-secondary flex-1">
              Try Again
            </button>
            <button onClick={() => nav('/guest')} className="btn-primary flex-1">
              Go Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
