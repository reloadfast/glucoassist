import { BrowserRouter, Route, Routes } from 'react-router-dom'

import AppLayout from '@/components/layout/AppLayout'
import Dashboard from '@/pages/Dashboard'
import Patterns from '@/pages/Patterns'
import Statistics from '@/pages/Statistics'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/patterns" element={<Patterns />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
