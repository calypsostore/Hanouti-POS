import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { BRAND_NAME } from './lib/brand'
import logoImage from '../logo/logo1.png'

document.title = BRAND_NAME
const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
if (favicon) {
  favicon.href = logoImage
  favicon.type = 'image/png'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
