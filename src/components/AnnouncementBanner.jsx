import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AnnouncementBanner() {
  const [text, setText] = useState('')

  useEffect(() => {
    supabase
      .from('event_config')
      .select('value')
      .eq('key', 'announcement')
      .single()
      .then(({ data }) => { if (data?.value) setText(data.value) })

    const channel = supabase
      .channel('announcement')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'event_config',
        filter: 'key=eq.announcement',
      }, ({ new: row }) => setText(row.value))
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  if (!text) return null

  return (
    <div className="bg-shuttle/10 border border-shuttle/30 rounded-xl px-4 py-3 flex items-start gap-3">
      <span className="text-lg mt-0.5">📢</span>
      <p className="text-shuttle text-sm font-medium leading-snug">{text}</p>
    </div>
  )
}
