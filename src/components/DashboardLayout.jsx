import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signOutUser } from '../firebase/auth'
import { getUserProfile } from '../firebase/users'
import nagaLogo from '../assets/naga-logo.jpg'
import '../styles/Home.css'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠', path: '/home' },
  { id: 'requests', label: 'Requests', icon: '📋', path: '/requests' },
  { id: 'inventory', label: 'Inventory', icon: '📦', path: '/inventory' },
  { id: 'beneficiaries', label: 'Beneficiaries', icon: '👨‍👩‍👧‍👦', path: '/beneficiaries' },
  { id: 'priority', label: 'Priority', icon: '⚠️', path: '/priority' },
  { id: 'donations', label: 'Donations', icon: '🎁', path: '/donations' },
  { id: 'map', label: 'View Map', icon: '🗺️', path: '/map' },
  { id: 'reports', label: 'Reports', icon: '📊', path: '/reports' },
  { id: 'settings', label: 'Settings', icon: '⚙️', path: '/settings' },
]

export default function DashboardLayout({ title, children, userLabel, userEmail }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!user?.uid) return
    getUserProfile(user.uid).then((p) => setIsAdmin(p?.role === 'Admin')).catch(() => {})
  }, [user?.uid])

  const navItems = isAdmin
    ? [...NAV_ITEMS, { id: 'autosuggest', label: 'Auto Suggest', icon: '💡', path: '/admin/auto-suggest' }, { id: 'admin', label: 'Admin', icon: '🛡️', path: '/admin' }]
    : NAV_ITEMS

  useEffect(() => {
    document.body.classList.add('dashboard-active')
    return () => document.body.classList.remove('dashboard-active')
  }, [])

  const handleSignOut = async () => {
    await signOutUser()
    navigate('/login')
  }

  const displayName = userLabel || user?.displayName || user?.email?.split('@')[0] || 'User'
  const email = userEmail || user?.email || ''

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('relieftrack_theme') || 'light-blue'
  })

  useEffect(() => {
    localStorage.setItem('relieftrack_theme', theme)
    if (theme === 'dark') {
      document.body.classList.add('theme-dark')
      document.body.classList.remove('theme-light-blue')
    } else {
      document.body.classList.add('theme-light-blue')
      document.body.classList.remove('theme-dark')
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((t) => (t === 'light-blue' ? 'dark' : 'light-blue'))
  }

  return (
    <div className={`dashboard ${theme === 'dark' ? 'theme-dark' : 'theme-light-blue'}`}>
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">
          <img src={nagaLogo} alt="ReliefTrack" />
          <span>ReliefTrack</span>
        </div>
        <nav className="dashboard-nav">
          {navItems.map((item) =>
            item.soon ? (
              <button
                key={item.id}
                type="button"
                className="dashboard-nav-item"
                disabled
              >
                <span>{item.icon}</span>
                {item.label}
                <span className="dashboard-nav-badge">Soon</span>
              </button>
            ) : (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) =>
                  `dashboard-nav-item${isActive ? ' active' : ''}`
                }
              >
                <span>{item.icon}</span>
                {item.label}
              </NavLink>
            )
          )}
        </nav>
      </aside>

      <div className="dashboard-main-wrap">
        <header className="dashboard-topbar">
          <h1>{title}</h1>
          <div className="dashboard-topbar-actions">
            <button
              type="button"
              className="dashboard-theme-toggle"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Eye-Comfort Light Blue' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? '🌤️ Light Blue' : '🌙 Dark'}
            </button>
            <div className="dashboard-user-meta">
              <div className="name">{displayName}</div>
              <div className="email">{email}</div>
            </div>
            <button type="button" className="dashboard-signout" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </header>
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  )
}
