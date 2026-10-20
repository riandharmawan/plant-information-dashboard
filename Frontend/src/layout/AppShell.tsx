import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar.tsx'
import { Topbar } from './Topbar.tsx'

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="app">
      <Topbar onToggleMenu={() => setMobileOpen((open) => !open)} />
      {mobileOpen && <button type="button" className="sidebar-overlay open" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
      <div className="main-wrap">
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
        />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
