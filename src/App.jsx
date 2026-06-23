import { Routes, Route } from 'react-router-dom'
import './App.css'
import ProtectedRoute from './components/ProtectedRoute'
import PublicRoute from './components/PublicRoute'
import RootRedirect from './components/RootRedirect'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import Home from './pages/Home'
import Requests from './pages/Requests'
import Inventory from './pages/Inventory'
import Settings from './pages/Settings'
import Reports from './pages/Reports'
import MapView from './pages/MapView'
import Beneficiaries from './pages/Beneficiaries'
import AdminDashboard from './pages/AdminDashboard'
import AdminSetup from './pages/AdminSetup'
import AdminAutoSuggest from './pages/AdminAutoSuggest'

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <SignUp />
          </PublicRoute>
        }
      />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/requests"
        element={
          <ProtectedRoute>
            <Requests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory"
        element={
          <ProtectedRoute>
            <Inventory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/map"
        element={
          <ProtectedRoute>
            <MapView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/beneficiaries"
        element={
          <ProtectedRoute>
            <Beneficiaries />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/auto-suggest"
        element={
          <ProtectedRoute>
            <AdminAutoSuggest />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/setup"
        element={
          <PublicRoute>
            <AdminSetup />
          </PublicRoute>
        }
      />
    </Routes>
  )
}

export default App
