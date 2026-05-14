import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const root = createRoot(document.getElementById('root')!)
// StrictMode double-invokes effects and renders in development to surface bugs.
// Keeping it out of production avoids 2× initialization cost on real devices.
if (import.meta.env.DEV) {
  root.render(<StrictMode><App /></StrictMode>)
} else {
  root.render(<App />)
}
// deploy 1776450299
