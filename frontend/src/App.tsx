import { BrowserRouter, Route, Routes } from 'react-router-dom'

import AppLayout from '@/components/layout/AppLayout'
import Dashboard from '@/pages/Dashboard'
import Intelligence from '@/pages/Intelligence'
import Patterns from '@/pages/Patterns'
import Settings from '@/pages/Settings'
import Statistics from '@/pages/Statistics'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/patterns" element={<Patterns />} />
          <Route path="/intelligence" element={<Intelligence />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
