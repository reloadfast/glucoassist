import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import AppLayout from '@/components/layout/AppLayout'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Statistics = lazy(() => import('@/pages/Statistics'))
const Patterns = lazy(() => import('@/pages/Patterns'))
const Intelligence = lazy(() => import('@/pages/Intelligence'))
const Settings = lazy(() => import('@/pages/Settings'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
      Loading…
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route
            path="/"
            element={
              <Suspense fallback={<PageLoader />}>
                <Dashboard />
              </Suspense>
            }
          />
          <Route
            path="/statistics"
            element={
              <Suspense fallback={<PageLoader />}>
                <Statistics />
              </Suspense>
            }
          />
          <Route
            path="/patterns"
            element={
              <Suspense fallback={<PageLoader />}>
                <Patterns />
              </Suspense>
            }
          />
          <Route
            path="/intelligence"
            element={
              <Suspense fallback={<PageLoader />}>
                <Intelligence />
              </Suspense>
            }
          />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<PageLoader />}>
                <Settings />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
