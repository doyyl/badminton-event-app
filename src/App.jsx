import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import LoadingSpinner from './components/LoadingSpinner'

// Critical path — eager loaded
import CheckIn from './pages/CheckIn'
import GuestPage from './pages/GuestPage'
import AdminLogin from './pages/admin/AdminLogin'
import AdminLayout from './pages/admin/AdminLayout'

// Lazy-loaded — split from main bundle
const ScanPage         = lazy(() => import('./pages/ScanPage'))
const FoodPage         = lazy(() => import('./pages/FoodPage'))
const ResultsPage      = lazy(() => import('./pages/ResultsPage'))
const BracketPage      = lazy(() => import('./pages/BracketPage'))
const RefereePage      = lazy(() => import('./pages/RefereePage'))
const RefereeCourtPage = lazy(() => import('./pages/RefereeCourtPage'))
const CourtCheckinPage = lazy(() => import('./pages/CourtCheckinPage'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminAttendees = lazy(() => import('./pages/admin/AdminAttendees'))
const AdminFood      = lazy(() => import('./pages/admin/AdminFood'))
const AdminResults   = lazy(() => import('./pages/admin/AdminResults'))
const AdminConfig    = lazy(() => import('./pages/admin/AdminConfig'))
const AdminQRCodes   = lazy(() => import('./pages/admin/AdminQRCodes'))
const AdminImport    = lazy(() => import('./pages/admin/AdminImport'))

function PageLoader() {
  return (
    <div className="min-h-dvh flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  )
}

function GuestGuard({ children }) {
  const guest = sessionStorage.getItem('badminton_guest')
  if (!guest) return <Navigate to="/" replace />
  return children
}

function AdminGuard({ children }) {
  const admin = sessionStorage.getItem('badminton_admin')
  if (!admin) return <Navigate to="/admin" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: { background: '#1a1a2e', color: '#fff', border: '1px solid #2d2d4e' },
        }}
      />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<CheckIn />} />
          <Route path="/guest" element={<GuestGuard><GuestPage /></GuestGuard>} />
          <Route path="/guest/scan" element={<GuestGuard><ScanPage /></GuestGuard>} />
          <Route path="/guest/food" element={<GuestGuard><FoodPage /></GuestGuard>} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/bracket" element={<BracketPage />} />
          <Route path="/court/:courtId" element={<CourtCheckinPage />} />
          <Route path="/referee" element={<RefereePage />} />
          <Route path="/referee/:courtId" element={<RefereeCourtPage />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route element={<AdminGuard><AdminLayout /></AdminGuard>}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/attendees" element={<AdminAttendees />} />
            <Route path="/admin/food" element={<AdminFood />} />
            <Route path="/admin/results" element={<AdminResults />} />
            <Route path="/admin/config" element={<AdminConfig />} />
            <Route path="/admin/qrcodes" element={<AdminQRCodes />} />
            <Route path="/admin/import" element={<AdminImport />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
