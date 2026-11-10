import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/dashboard.css'
import './styles/master.css'
import './styles/admin.css'
import './styles/user-management.css'
import './styles/management.css'
import './styles/data-source.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
