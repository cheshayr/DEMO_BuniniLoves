import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from '@/context/AuthContext'
import { SettingsProvider } from '@/context/SettingsContext'
import { CurrencyProvider } from '@/context/CurrencyContext'
import { CartProvider } from '@/context/CartContext'
import { WishlistProvider } from '@/context/WishlistContext'
import { installPhotoFallback } from '@/lib/assets'
import { PHOTO_FALLBACKS } from '@/lib/demoData'
import './styles/index.css'

installPhotoFallback(PHOTO_FALLBACKS)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <SettingsProvider>
          <CurrencyProvider>
            <CartProvider>
              <WishlistProvider>
                <App />
              </WishlistProvider>
            </CartProvider>
          </CurrencyProvider>
        </SettingsProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>,
)
