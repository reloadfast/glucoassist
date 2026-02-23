import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './components/ThemeProvider.tsx'
import { TimezoneProvider } from './components/TimezoneProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <TimezoneProvider>
        <App />
      </TimezoneProvider>
    </ThemeProvider>
  </StrictMode>,
)
