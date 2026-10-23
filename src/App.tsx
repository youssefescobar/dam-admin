import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/lib/theme'
import { AuthProvider } from '@/features/auth/auth-context'
import { LoginPage } from '@/features/auth/login-page'
import { AppShell } from '@/components/layout/app-shell'
import { Toaster } from '@/components/ui/sonner'

// Each page is its own file, downloaded the first time it's opened.
const QuotesPage = lazy(() => import('@/features/quotes/quotes-page').then((m) => ({ default: m.QuotesPage })))
const InboxPage = lazy(() => import('@/features/chat/inbox-page').then((m) => ({ default: m.InboxPage })))
const ReportsPage = lazy(() => import('@/features/reports/reports-page').then((m) => ({ default: m.ReportsPage })))
const KbPage = lazy(() => import('@/features/kb/kb-page').then((m) => ({ default: m.KbPage })))
const InsightsPage = lazy(() => import('@/features/insights/insights-page').then((m) => ({ default: m.InsightsPage })))
const ContentPage = lazy(() => import('@/features/content/content-page').then((m) => ({ default: m.ContentPage })))
const SettingsPage = lazy(() => import('@/features/settings/settings-page').then((m) => ({ default: m.SettingsPage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<AppShell />}>
                <Route path="/quotes" element={<QuotesPage />} />
                <Route path="/inbox" element={<InboxPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/kb" element={<KbPage />} />
                <Route path="/insights" element={<InsightsPage />} />
                <Route path="/content" element={<ContentPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/quotes" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
