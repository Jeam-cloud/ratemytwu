import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import "./index.css"
import "./styles/tokens.css"

createRoot(document.getElementById('root')).render(
  <HelmetProvider>
    <BrowserRouter>
        <StrictMode>
            <App />
        </StrictMode>
    </BrowserRouter>
  </HelmetProvider>
)
