import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { onAuthChanged, signOut } from './lib/auth'
import { upsertProfile } from './lib/firestore'
import Sidebar, { BottomNav } from './components/Sidebar'
import DashboardPage from './pages/DashboardPage'
import StudyPage from './pages/StudyPage'
import QueuePage from './pages/QueuePage'
import DictionaryPage from './pages/DictionaryPage'
import ImportPage from './pages/ImportPage'
import SettingsPage from './pages/SettingsPage'
import LoginPage from './pages/LoginPage'

function AppShell({ user }: { user: User }) {
  return (
    <div className="flex h-screen bg-surface text-text-primary overflow-hidden">
      <Sidebar user={user} />
      <main className="flex-1 min-h-0 overflow-auto pb-14 md:pb-0">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/study" element={<StudyPage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/dictionary" element={<DictionaryPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState<User | null | 'loading'>('loading')
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    return onAuthChanged(async (u) => {
      if (!u) {
        setUser(null)
        return
      }

      const allowedEmail = import.meta.env.VITE_ALLOWED_EMAIL as string | undefined
      if (allowedEmail && u.email !== allowedEmail) {
        await signOut()
        setAuthError('Access denied: unauthorized email')
        setUser(null)
        return
      }

      await upsertProfile(u.uid, {
        email: u.email ?? '',
        name: u.displayName ?? u.email ?? '',
        picture: u.photoURL ?? '',
      })
      setUser(u)
    })
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              user && user !== 'loading' ? (
                <Navigate to="/" replace />
              ) : (
                <LoginPage error={authError} />
              )
            }
          />
          <Route
            path="*"
            element={
              user === 'loading' ? (
                <div className="min-h-screen flex items-center justify-center bg-surface text-text-muted text-sm">
                  Loading…
                </div>
              ) : user === null ? (
                <Navigate to="/login" replace />
              ) : (
                <AppShell user={user} />
              )
            }
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
