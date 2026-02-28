import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ThemeProvider } from './components/ThemeProvider.tsx'
import { TimezoneProvider } from './components/TimezoneProvider.tsx'
import { TooltipProvider } from './components/ui/tooltip.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <TimezoneProvider>
          <TooltipProvider>
            <App />
          </TooltipProvider>
        </TimezoneProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
