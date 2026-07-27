import React from 'react'
import ReactDOM from 'react-dom/client'
import { AIChatPopup } from './components/AIChatPopup'
import './index.css'
import './styles/codex.css'
import './styles/tokens.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AIChatPopup />
  </React.StrictMode>
)
