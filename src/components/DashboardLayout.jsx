import { useEffect, useState, useRef } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signOutUser } from '../firebase/auth'
import nagaLogo from '../assets/naga-logo.jpg'
import '../styles/Home.css'
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Users,
  TriangleAlert,
  Gift,
  Map,
  ChartNoAxesColumn,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Siren,
  Search,
} from 'lucide-react'

const USER_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/home' },
  { id: 'requests', label: 'My Relief Requests', icon: ClipboardList, path: '/requests' },
  { id: 'donations', label: 'Donations & Aid', icon: Gift, path: '/donations' },
  { id: 'map', label: 'Map', icon: Map, path: '/map' },
  { id: 'reports', label: 'Reports', icon: ChartNoAxesColumn, path: '/reports' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
]

const ADMIN_NAV_ITEMS = [
  { id: 'admin-dashboard', label: 'Admin Dashboard', icon: LayoutDashboard, path: '/admin' },
  { id: 'requests', label: 'Relief Requests', icon: ClipboardList, path: '/requests' },
  { id: 'priority', label: 'Priority Assessment', icon: TriangleAlert, path: '/priority' },
  { id: 'inventory', label: 'Inventory Management', icon: Package, path: '/inventory' },
  { id: 'beneficiaries', label: 'Beneficiaries', icon: Users, path: '/beneficiaries' },
  { id: 'donations', label: 'Donations', icon: Gift, path: '/donations' },
  { id: 'map', label: 'Map', icon: Map, path: '/map' },
  { id: 'reports', label: 'Reports & Analytics', icon: ChartNoAxesColumn, path: '/reports' },
  { id: 'autosuggest', label: 'Auto Suggest', icon: Sparkles, path: '/admin/auto-suggest' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
]

export default function DashboardLayout({
  title = 'Dashboard',
  children,
  userLabel,
  userEmail,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search relief records...',
  headerActions,
}) {
  const { user, userProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [unreadNotifs, setUnreadNotifs] = useState(2)

  const notifRef = useRef(null)
  const userMenuRef = useRef(null)

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  const isAdmin =
    (adminEmail && user?.email?.toLowerCase() === adminEmail.toLowerCase()) ||
    userProfile?.role === 'Admin'

  const navItems = isAdmin ? ADMIN_NAV_ITEMS : USER_NAV_ITEMS

  useEffect(() => {
    document.body.classList.add('dashboard-active')
    return () => document.body.classList.remove('dashboard-active')
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])


  const displayName =
    userLabel ||
    userProfile?.displayName ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    (isAdmin ? 'Administrator' : 'User')
  const email = userEmail || userProfile?.email || user?.email || ''
  const roleLabel = isAdmin ? 'Administrator' : 'Community Member'

  const handleSignOut = async () => {
    try {
      await signOutUser()
      navigate('/login')
    } catch (err) {
      console.error('Sign out failed:', err)
    }
  }

  const getInitials = (name) => {
    if (!name) return 'RT'
    const parts = name.trim().split(' ').filter(Boolean)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div className="dashboard">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="dashboard-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Navy Blue Sidebar */}
      <aside className={`dashboard-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="dashboard-brand">
          <img src={nagaLogo} alt="ReliefTrack Logo" />
          <div className="dashboard-brand-text">
            <span className="brand-title">ReliefTrack</span>
            <span className="brand-subtitle">
              {isAdmin ? 'Relief Operations' : 'Community Relief Portal'}
            </span>
          </div>
          <button
            type="button"
            className="dashboard-mobile-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="dashboard-nav">
          <div className="dashboard-nav-section-label">Main Navigation</div>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/home' && item.path !== '/admin' && location.pathname.startsWith(item.path))
            return (
              <NavLink
                key={item.id}
                to={item.path}
                className={`dashboard-nav-item ${isActive ? 'active' : ''}`}
                end={item.path === '/home' || item.path === '/admin'}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="dashboard-nav-icon">
                  <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                </span>
                <span className="dashboard-nav-label">{item.label}</span>
                {isActive && <ChevronRight size={16} className="dashboard-nav-arrow" />}
              </NavLink>
            )
          })}
        </nav>

        {/* Sidebar Footer User & Logout */}
        <div className="dashboard-sidebar-footer">
          <div className="dashboard-sidebar-user">
            <div className={`dashboard-sidebar-avatar ${isAdmin ? 'admin-avatar' : ''}`}>
              {getInitials(displayName)}
            </div>
            <div className="dashboard-sidebar-user-meta">
              <div className="sidebar-user-name" title={displayName}>
                {displayName}
              </div>
              <div className="sidebar-user-role">
                <span className={`role-pill ${isAdmin ? 'pill-admin' : 'pill-member'}`}>
                  {isAdmin ? 'Admin' : 'Member'}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="dashboard-sidebar-logout-btn"
            onClick={handleSignOut}
            title="Log out of ReliefTrack"
            aria-label="Log out"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="dashboard-main-wrap">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-left">
            <button
              type="button"
              className="dashboard-mobile-toggle"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={22} />
            </button>
            <div className="dashboard-topbar-title-group">
              <h1 className="dashboard-topbar-title">{title}</h1>
              <div className="dashboard-topbar-status">
                <span className="status-indicator-dot" />
                <span className="status-indicator-text">City of Naga Operations Active</span>
              </div>
            </div>
          </div>

          <div className="dashboard-topbar-actions">
            {/* Global / Section Search Input if supplied */}
            {onSearchChange && (
              <div className="dashboard-topbar-search">
                <Search size={16} className="topbar-search-icon" />
                <input
                  type="text"
                  value={searchQuery || ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label="Search"
                />
              </div>
            )}

            {/* Custom Header Actions */}
            {headerActions}

            {/* Notification Bell */}
            <div className="dashboard-notif-wrapper" ref={notifRef}>
              <button
                type="button"
                className={`dashboard-icon-btn ${unreadNotifs > 0 ? 'has-unread' : ''}`}
                onClick={() => setNotifOpen((prev) => !prev)}
                title="Relief alerts & updates"
                aria-label="Notifications"
              >
                <Bell size={20} />
                {unreadNotifs > 0 && <span className="notif-badge">{unreadNotifs}</span>}
              </button>

              {notifOpen && (
                <div className="dashboard-notif-popover">
                  <div className="notif-popover-header">
                    <div className="notif-popover-title">
                      <Siren size={18} className="text-red" />
                      <span>Relief Alerts & Updates</span>
                    </div>
                    {unreadNotifs > 0 && (
                      <button
                        type="button"
                        className="notif-mark-read"
                        onClick={() => setUnreadNotifs(0)}
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                  <div className="notif-popover-list">
                    <div className="notif-item critical">
                      <div className="notif-item-icon">
                        <TriangleAlert size={16} />
                      </div>
                      <div className="notif-item-content">
                        <div className="notif-item-title">Urgent Relief Aid Request - Inoburan & Tinaan</div>
                        <div className="notif-item-desc">
                          Emergency relief goods and clean water requested for affected families. Dispatch team preparing aid packages.
                        </div>
                        <div className="notif-item-time">15 mins ago</div>
                      </div>
                    </div>
                    <div className="notif-item info">
                      <div className="notif-item-icon">
                        <ShieldCheck size={16} />
                      </div>
                      <div className="notif-item-content">
                        <div className="notif-item-title">Relief Distribution Centers Active</div>
                        <div className="notif-item-desc">
                          Naga Central Elementary and Tuyan distribution hubs active with food packs & essential supplies.
                        </div>
                        <div className="notif-item-time">1 hour ago</div>
                      </div>
                    </div>
                  </div>
                  <div className="notif-popover-footer">
                    <NavLink
                      to="/map"
                      className="notif-view-all"
                      onClick={() => setNotifOpen(false)}
                    >
                      View Relief Operations Map →
                    </NavLink>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Menu */}
            <div className="dashboard-profile-wrapper" ref={userMenuRef}>
              <button
                type="button"
                className="dashboard-profile-pill"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-expanded={userMenuOpen}
              >
                <div className={`dashboard-topbar-avatar ${isAdmin ? 'admin-avatar' : ''}`}>
                  {getInitials(displayName)}
                </div>
                <div className="dashboard-user-meta">
                  <div className="name">{displayName}</div>
                  <div className="role-tag">{roleLabel}</div>
                </div>
                <ChevronDown size={14} className="profile-pill-arrow" />
              </button>

              {userMenuOpen && (
                <div className="dashboard-profile-dropdown">
                  <div className="dropdown-user-header">
                    <div className="dropdown-user-name">{displayName}</div>
                    <div className="dropdown-user-email">{email}</div>
                    <span className={`role-badge ${isAdmin ? 'admin' : 'member'}`}>
                      {roleLabel}
                    </span>
                  </div>
                  <div className="dropdown-divider" />
                  <NavLink
                    to="/settings"
                    className="dropdown-item"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Settings size={16} />
                    <span>Account Settings</span>
                  </NavLink>
                  <button
                    type="button"
                    className="dropdown-item text-red"
                    onClick={handleSignOut}
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  )
}
