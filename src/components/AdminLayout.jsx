import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/AdminLayout.css'

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: '▦' },
  { to: '/requests', label: 'Requests', icon: '☰' },
  { to: '/inventory', label: 'Inventory', icon: '⊞' },
  { to: '/reports', label: 'Reports', icon: '⡇' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

export default function AdminLayout({ title, userLabel, userEmail, children }) {
  const { logout } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="admin-layout">
      <aside className={`admin-aside${collapsed ? ' collapsed' : ''}`}>
        <div className="admin-aside-header">
          <div className="admin-aside-logo">
            <span className="admin-aside-shield">⛨</span>
            {!collapsed && <span className="admin-aside-brand">ReliefTrack</span>}
          </div>
          <button className="admin-aside-toggle" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? '▶' : '◀'}
          </button>
        </div>

        <nav className="admin-aside-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`admin-nav-item${location.pathname === item.to ? ' active' : ''}`}
            >
              <span className="admin-nav-icon">{item.icon}</span>
              {!collapsed && <span className="admin-nav-label">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="admin-aside-footer">
          <div className="admin-aside-user">
            {!collapsed && (
              <div className="admin-aside-user-info">
                <div className="admin-aside-user-name">{userLabel}</div>
                <div className="admin-aside-user-role">Administrator</div>
              </div>
            )}
            <button className="admin-aside-logout" onClick={logout} title="Logout">
              ⏻
            </button>
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <h1 className="admin-topbar-title">{title}</h1>
          <div className="admin-topbar-meta">
            <span className="admin-topbar-user">{userEmail}</span>
            <span className="admin-topbar-pill">Admin</span>
          </div>
        </header>
        <main className="admin-content">
          {children}
        </main>
      </div>
    </div>
  )
}
