import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useActiveSite } from '../data/ActiveSiteContext.tsx'
import { Sidebar } from './Sidebar.tsx'
import { Topbar } from './Topbar.tsx'

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { siteId } = useActiveSite()

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
          {/* Switching site remounts the page, so every screen loads the new site from scratch. */}
          <Outlet key={siteId} />
        </main>
      </div>
    </div>
  )
}
