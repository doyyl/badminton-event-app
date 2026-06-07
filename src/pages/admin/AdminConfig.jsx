import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function AdminConfig() {
  const [announcement, setAnnouncement] = useState('')
  const [seatingUrl, setSeatingUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('event_config')
      .select('key,value')
      .in('key', ['announcement', 'seating_map_url'])
      .then(({ data }) => {
        const cfg = Object.fromEntries((data || []).map(r => [r.key, r.value]))
        setAnnouncement(cfg.announcement || '')
        setSeatingUrl(cfg.seating_map_url || '')
      })
      .finally(() => setLoading(false))
  }, [])

  async function saveAnnouncement() {
    setSaving(true)
    try {
      await supabase.from('event_config').upsert({ key: 'announcement', value: announcement })
      toast.success('Announcement updated!')
    } finally {
      setSaving(false)
    }
  }

  async function clearAnnouncement() {
    setAnnouncement('')
    await supabase.from('event_config').upsert({ key: 'announcement', value: '' })
    toast.success('Announcement cleared')
  }

  async function saveSeating() {
    setSaving(true)
    try {
      await supabase.from('event_config').upsert({ key: 'seating_map_url', value: seatingUrl })
      toast.success('Seating map updated!')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center pt-12"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-5">
      <h1 className="font-black text-2xl">Event Config</h1>

      {/* Announcement */}
      <div className="card space-y-3">
        <h2 className="font-bold">📢 Announcement</h2>
        <p className="text-xs text-gray-400">Shown as a banner on all guest pages in real time.</p>
        <textarea
          className="input resize-none"
          rows={3}
          value={announcement}
          onChange={e => setAnnouncement(e.target.value)}
          placeholder="e.g. 'Finals starting at 3pm on Court 1!'"
        />
        <div className="flex gap-2">
          <button onClick={saveAnnouncement} className="btn-primary flex-1" disabled={saving}>
            {saving ? 'Saving...' : '📡 Broadcast'}
          </button>
          {announcement && (
            <button onClick={clearAnnouncement} className="btn-secondary px-4">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Seating map */}
      <div className="card space-y-3">
        <h2 className="font-bold">📍 Seating Map</h2>
        <p className="text-xs text-gray-400">
          Paste a direct image URL (Supabase Storage, Imgur, etc.) or upload to Supabase Storage and paste the public URL here.
        </p>
        <div>
          <label className="label">Image URL</label>
          <input
            className="input"
            value={seatingUrl}
            onChange={e => setSeatingUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        {seatingUrl && (
          <div className="rounded-xl overflow-hidden border border-dark-border">
            <img src={seatingUrl} alt="Seating Map Preview" className="w-full h-auto max-h-64 object-contain" />
          </div>
        )}

        <button onClick={saveSeating} className="btn-primary w-full" disabled={saving}>
          {saving ? 'Saving...' : '💾 Save Seating Map'}
        </button>
      </div>

      {/* Supabase Storage instructions */}
      <div className="card space-y-2 bg-dark-bg border-dark-border">
        <h3 className="font-semibold text-sm">How to upload to Supabase Storage</h3>
        <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
          <li>Go to your Supabase project → Storage</li>
          <li>Create a public bucket named <code className="text-court">event-assets</code></li>
          <li>Upload your seating map image</li>
          <li>Click the image → Get URL → copy and paste above</li>
        </ol>
      </div>
    </div>
  )
}
