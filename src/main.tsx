import { Capacitor } from '@capacitor/core'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { BRAND_NAME } from './lib/brand'

document.title = BRAND_NAME
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('native-app')
}

const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
if (favicon) {
  favicon.href = '/favicon-32.png'
  favicon.type = 'image/png'
}

if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator && window.isSecureContext) {
  void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
    console.error('7anouti: service worker registration failed.', error)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
