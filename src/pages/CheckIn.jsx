import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner'

const COMPANIES = ['COV', 'AVT', 'Thai MFC', 'DOW', 'SOLVAY', 'Styrenix', 'TEX', 'TPAC', 'BEE', 'KNS', 'KNT', 'Other']
const CATEGORIES = ['Basic', 'Expert', 'Substitute', 'Follower']
const REMEMBER_KEY = 'badminton_username'

export default function CheckIn() {
  const nav = useNavigate()
  const [step, setStep] = useState('home') // 'home' | 'email' | 'confirm' | 'walkin'
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState(() => localStorage.getItem(REMEMBER_KEY) || '')
  const [walkinEmail, setWalkinEmail] = useState('')
  const [found, setFound] = useState(null)
  const [walkin, setWalkin] = useState({ name: '', company: 'COV', category: 'Basic' })

  // An existing guest session means the user came back (e.g. browser back) without
  // logging out — offer a one-tap continue instead of forcing a fresh login.
  const rememberedGuest = (() => {
    try { return JSON.parse(sessionStorage.getItem('badminton_guest') || 'null') } catch { return null }
  })()

  async function handleEmailSubmit(e) {
    e.preventDefault()
    if (!username.trim()) return
    setLoading(true)
    try {
      // ILIKE may match multiple rows (duplicate emails / repeat walk-ins), so
      // never use .maybeSingle() here — it 406s on >1 match and would dump the
      // user into walk-in registration, spawning yet another duplicate row.
      // Prefer an already-checked-in row so re-login lands on the existing pass.
      const { data: matches, error } = await supabase
        .from('attendees')
        .select('*')
        .ilike('email', `${username.trim()}@%`)
        .order('checked_in', { ascending: false })
        .order('external_id', { ascending: true })
        .limit(1)

      if (error) {
        toast.error('เข้าสู่ระบบไม่สำเร็จ ลองอีกครั้ง')
        return
      }

      const data = matches?.[0]
      if (data) {
        if (data.checked_in) {
          toast('เช็คอินแล้วในชื่อ ' + data.name, { icon: '✅' })
          saveGuest(data)
          nav('/guest')
          return
        }
        setFound(data)
        setStep('confirm')
      } else {
        setStep('walkin')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmCheckIn() {
    setLoading(true)
    try {
      await supabase
        .from('attendees')
        .update({ checked_in: true, check_in_time: new Date().toISOString() })
        .eq('id', found.id)
      toast.success('ยินดีต้อนรับ, ' + found.name + '!')
      saveGuest({ ...found, checked_in: true })
      nav('/guest')
    } finally {
      setLoading(false)
    }
  }

  async function handleWalkInSubmit(e) {
    e.preventDefault()
    if (!walkin.name.trim()) return
    setLoading(true)
    try {
      const { data: existing } = await supabase
        .from('attendees')
        .select('external_id')
        .like('external_id', 'W%')

      const maxNum = (existing || []).reduce((max, r) => {
        const n = parseInt(r.external_id.slice(1))
        return isNaN(n) ? max : Math.max(max, n)
      }, 0)
      const externalId = 'W' + (maxNum + 1)
      const { data, error } = await supabase
        .from('attendees')
        .insert({
          external_id: externalId,
          name: walkin.name.trim(),
          email: walkinEmail.trim() || null,
          company: walkin.company,
          category: walkin.category,
          role: walkin.category === 'Follower' ? 'spectator' : 'athlete',
          checked_in: true,
          check_in_time: new Date().toISOString(),
          walk_in: true,
        })
        .select()
        .single()

      if (error) throw error
      toast.success('ยินดีต้อนรับ, ' + data.name + '!')
      saveGuest(data)
      nav('/guest')
    } catch (err) {
      console.error('Registration error:', err)
      toast.error(err?.message || 'ลงทะเบียนไม่สำเร็จ ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  function saveGuest(data) {
    sessionStorage.setItem('badminton_guest', JSON.stringify({
      external_id: data.external_id,
      name: data.name,
      category: data.category,
      role: data.role,
      company: data.company,
    }))
    // Remember the username so returning users don't have to retype it.
    const remembered = data.email ? data.email.split('@')[0] : username.trim()
    if (remembered) localStorage.setItem(REMEMBER_KEY, remembered)
  }

  // Home screen
  if (step === 'home') {
    return (
      <div className="min-h-dvh flex flex-col bg-gray-50 max-w-lg mx-auto">
        {/* Hero */}
        <div className="bg-gradient-to-b from-slate-400 to-slate-300 px-6 pt-14 pb-10 text-center">
          <p className="text-xs font-bold text-white/70 uppercase tracking-widest mb-4">SMASH BADMINTON</p>
          <h1 className="text-4xl font-black text-white leading-tight">Badminton</h1>
          <h2 className="text-3xl font-black text-primary mt-1">Tournament 2026!</h2>
          <p className="text-white/70 text-sm mt-3">
            ทัวร์นาเมนต์แบดมินตันองค์กร — เข้าสู่ระบบด้วยชื่อผู้ใช้เพื่อดูบัตรของคุณ
          </p>
        </div>

        {/* Actions */}
        <div className="flex-1 px-4 py-6 space-y-3">
          {rememberedGuest?.external_id && (
            <button
              onClick={() => nav('/guest')}
              className="btn-primary w-full py-4 text-base"
            >
              <span>→</span> เข้าต่อในชื่อ {rememberedGuest.name}
            </button>
          )}

          <button
            onClick={() => {
              // Coming from a one-tap continue, the username is still the previous
              // guest's — clear it so "log in as someone else" starts blank.
              if (rememberedGuest?.external_id) setUsername('')
              setStep('email')
            }}
            className={rememberedGuest?.external_id ? 'btn-secondary w-full' : 'btn-primary w-full py-4 text-base'}
          >
            {rememberedGuest?.external_id ? 'เข้าสู่ระบบด้วยชื่ออื่น' : <><span>→</span> เข้าสู่ระบบเพื่อเช็คอิน</>}
          </button>

          <p className="text-center text-xs text-gray-400">หรือ</p>

          <button
            onClick={() => setStep('walkin')}
            className="btn-secondary w-full"
          >
            ลงทะเบียนหน้างาน (Walk-in)
          </button>

          <div className="pt-4 space-y-2">
            <p className="section-label">ข้อมูลงาน</p>
            <button onClick={() => nav('/results')} className="nav-item text-left">
              <div className="flex items-center gap-3">
                <span className="text-lg">🏆</span>
                <span className="font-semibold text-gray-800">ผลการแข่งขันสด</span>
              </div>
              <span className="text-gray-400">›</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-8 text-center">
          <button
            onClick={() => nav('/admin')}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5 mx-auto"
          >
            🛡️ Staff admin
          </button>
          <button
            onClick={() => nav('/referee')}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5 mx-auto mt-2"
          >
            🏸 Referee panel
          </button>
        </div>
      </div>
    )
  }

  // Email step
  if (step === 'email') {
    return (
      <div className="min-h-dvh flex flex-col bg-gray-50 max-w-lg mx-auto">
        <header className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-200">
          <button onClick={() => setStep('home')} className="flex items-center gap-1 text-gray-600 font-semibold">
            <span className="text-lg">←</span> ย้อนกลับ
          </button>
          <h2 className="font-bold text-gray-900">เข้าสู่ระบบ</h2>
        </header>
        <div className="flex-1 p-4">
          <form onSubmit={handleEmailSubmit} className="space-y-4 mt-4">
            <div>
              <label className="label">ชื่อผู้ใช้</label>
              <input
                className="input"
                type="text"
                placeholder="yourname"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                required
              />
              <p className="text-xs text-gray-400 mt-1">ส่วนที่อยู่หน้า @ ในอีเมลของคุณ</p>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <LoadingSpinner size="sm" /> : 'ดำเนินการต่อ →'}
            </button>
            <p className="text-center text-sm text-gray-500">
              ยังไม่ได้ลงทะเบียน?{' '}
              <button type="button" className="text-primary font-semibold" onClick={() => setStep('walkin')}>
                ลงทะเบียนหน้างาน
              </button>
            </p>
          </form>
        </div>
      </div>
    )
  }

  // Confirm check-in
  if (step === 'confirm' && found) {
    return (
      <div className="min-h-dvh flex flex-col bg-gray-50 max-w-lg mx-auto">
        <header className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-200">
          <button onClick={() => { setStep('email'); setFound(null) }} className="flex items-center gap-1 text-gray-600 font-semibold">
            <span className="text-lg">←</span> ย้อนกลับ
          </button>
          <h2 className="font-bold text-gray-900">ยืนยันการเช็คอิน</h2>
        </header>
        <div className="p-4 space-y-4 mt-4">
          <div className="card space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-xl font-black text-primary">
                {found.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-lg text-gray-900">{found.name}</p>
                <p className="text-sm text-gray-500">{found.category} · {found.company}</p>
              </div>
            </div>
            <div className="text-sm text-gray-500 space-y-1 bg-gray-50 rounded-xl p-3">
              <p>รหัส: <span className="text-gray-900 font-mono font-semibold">{found.external_id}</span></p>
              <p>บทบาท: <span className="text-gray-900 capitalize">{found.role}</span></p>
            </div>
          </div>
          <button className="btn-primary w-full" onClick={handleConfirmCheckIn} disabled={loading}>
            {loading ? <LoadingSpinner size="sm" /> : '✅ ยืนยันการเช็คอิน'}
          </button>
        </div>
      </div>
    )
  }

  // Walk-in registration
  return (
    <div className="min-h-dvh flex flex-col bg-gray-50 max-w-lg mx-auto">
      <header className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-200">
        <button onClick={() => setStep('home')} className="flex items-center gap-1 text-gray-600 font-semibold">
          <span className="text-lg">←</span> ย้อนกลับ
        </button>
        <h2 className="font-bold text-gray-900">ลงทะเบียนหน้างาน</h2>
      </header>
      <div className="flex-1 p-4">
        <form onSubmit={handleWalkInSubmit} className="space-y-4 mt-4">
          <div>
            <label className="label">ชื่อ-นามสกุล *</label>
            <input
              className="input"
              placeholder="ชื่อของคุณ"
              value={walkin.name}
              onChange={e => setWalkin(w => ({ ...w, name: e.target.value }))}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">อีเมล (ไม่บังคับ)</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={walkinEmail}
              onChange={e => setWalkinEmail(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">บริษัท</label>
              <select className="input" value={walkin.company} onChange={e => setWalkin(w => ({ ...w, company: e.target.value }))}>
                {COMPANIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">ประเภท</label>
              <select className="input" value={walkin.category} onChange={e => setWalkin(w => ({ ...w, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? <LoadingSpinner size="sm" /> : '🏸 ลงทะเบียนและเช็คอิน'}
          </button>
        </form>
      </div>
    </div>
  )
}
