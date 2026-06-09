import { useState } from 'react'
import { FOOD_META } from '../../lib/foodMeta'

const FOOD_IDS = [
  'wrap', 'mc_chicken', 'croffle', 'icecream', 'fruits',
  'energy_bar', 'bbq', 'beer', 'soft_drink', 'hydration', 'water',
]
const COURTS = Array.from({ length: 10 }, (_, i) => i + 1)

function qrUrl(data, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&ecc=M&format=png`
}

export default function AdminQRCodes() {
  const [size, setSize] = useState(220)
  const [section, setSection] = useState('courts') // 'courts' | 'food'
  const origin = window.location.origin

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-black text-2xl">QR Codes</h1>
        <div className="flex items-center gap-3">
          <label className="label mb-0 text-sm">Size</label>
          <select
            className="input w-32 py-2 text-sm"
            value={size}
            onChange={e => setSize(Number(e.target.value))}
          >
            <option value={160}>Small</option>
            <option value={220}>Medium</option>
            <option value={300}>Large</option>
          </select>
          <button onClick={() => window.print()} className="btn-primary py-2 px-4 text-sm">
            🖨️ Print All
          </button>
        </div>
      </div>

      {/* Section toggle */}
      <div className="flex gap-2 no-print">
        <button
          onClick={() => setSection('courts')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${section === 'courts' ? 'bg-primary text-black' : 'btn-secondary'}`}
        >
          🏟️ Court QR Codes
        </button>
        <button
          onClick={() => setSection('food')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${section === 'food' ? 'bg-primary text-black' : 'btn-secondary'}`}
        >
          🍽️ Food QR Codes
        </button>
      </div>

      {/* Court QR Codes */}
      {section === 'courts' && (
        <>
          <p className="text-gray-400 text-sm">
            Place one card at each court. Athletes scan to confirm arrival at their court.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 print:grid-cols-3">
            {COURTS.map(n => {
              const url = `${origin}/court/${n}`
              return (
                <div
                  key={n}
                  className="card flex flex-col items-center gap-3 text-center print:border print:border-gray-300 print:shadow-none print:bg-white print:text-black"
                >
                  <p className="text-2xl">🏟️</p>
                  <p className="font-black text-xl">Court {n}</p>
                  <img
                    src={qrUrl(url, size)}
                    alt={`QR code for Court ${n}`}
                    width={size}
                    height={size}
                    className="rounded-xl"
                    loading="lazy"
                  />
                  <p className="font-mono text-xs text-gray-400 print:text-gray-600 break-all">/court/{n}</p>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Food QR Codes */}
      {section === 'food' && (
        <>
          <p className="text-gray-400 text-sm">
            Print these cards and place one at each food station. Guests scan them to claim their food.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 print:grid-cols-3">
            {FOOD_IDS.map(id => {
              const meta = FOOD_META[id] || { name: id, emoji: '🍽️' }
              const value = `FOOD:${id}`
              return (
                <div
                  key={id}
                  className="card flex flex-col items-center gap-3 text-center print:border print:border-gray-300 print:shadow-none print:bg-white print:text-black"
                >
                  <p className="text-2xl">{meta.emoji}</p>
                  <p className="font-black text-lg">{meta.name}</p>
                  <img
                    src={qrUrl(value, size)}
                    alt={`QR code for ${meta.name}`}
                    width={size}
                    height={size}
                    className="rounded-xl"
                    loading="lazy"
                  />
                  <p className="font-mono text-xs text-gray-400 print:text-gray-600">{value}</p>
                </div>
              )
            })}
          </div>
        </>
      )}

      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          header, nav, .no-print { display: none !important; }
          .card { break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}
