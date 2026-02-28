import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import AppLayout from '@/components/layout/AppLayout'
import { Skeleton } from '@/components/ui/skeleton'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Statistics = lazy(() => import('@/pages/Statistics'))
const Patterns = lazy(() => import('@/pages/Patterns'))
const Intelligence = lazy(() => import('@/pages/Intelligence'))
const Basal = lazy(() => import('@/pages/Basal'))
const Food = lazy(() => import('@/pages/Food'))
const Logs = lazy(() => import('@/pages/Logs'))
const Settings = lazy(() => import('@/pages/Settings'))

function PageLoader() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
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
            path="/basal"
            element={
              <Suspense fallback={<PageLoader />}>
                <Basal />
              </Suspense>
            }
          />
          <Route
            path="/food"
            element={
              <Suspense fallback={<PageLoader />}>
                <Food />
              </Suspense>
            }
          />
          <Route
            path="/logs"
            element={
              <Suspense fallback={<PageLoader />}>
                <Logs />
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
