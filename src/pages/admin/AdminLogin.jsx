import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function AdminLogin() {
  const nav = useNavigate()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (sessionStorage.getItem('badminton_admin')) {
    return <Navigate to="/admin/dashboard" replace />
  }

  function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      const expected = import.meta.env.VITE_ADMIN_PASSWORD || 'smash2024'
      if (password === expected) {
        sessionStorage.setItem('badminton_admin', '1')
        nav('/admin/dashboard', { replace: true })
      } else {
        toast.error('Wrong password')
        setPassword('')
      }
      setLoading(false)
    }, 300)
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl">🛡️</div>
          <h1 className="text-2xl font-black text-gray-900">Staff Admin</h1>
          <p className="text-gray-400 text-sm">SMASH Tournament Control Panel</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? '...' : 'Enter →'}
          </button>
        </form>
        <p className="text-center">
          <button className="text-gray-400 text-sm hover:text-gray-700" onClick={() => nav('/')}>
            ← Guest Check-in
          </button>
        </p>
      </div>
    </div>
  )
}
