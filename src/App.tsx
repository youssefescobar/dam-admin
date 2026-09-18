import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@/features/auth/auth-context'
import { LoginPage } from '@/features/auth/login-page'
import { AppShell } from '@/components/layout/app-shell'
import { QuotesPage } from '@/features/quotes/quotes-page'
import { InboxPage } from '@/features/chat/inbox-page'
import { AiPlaygroundPage } from '@/features/ai/ai-playground-page'
import { KbPage } from '@/features/kb/kb-page'
import { Toaster } from '@/components/ui/sonner'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<AppShell />}>
                <Route path="/quotes" element={<QuotesPage />} />
                <Route path="/inbox" element={<InboxPage />} />
                <Route path="/kb" element={<KbPage />} />
                <Route path="/ai" element={<AiPlaygroundPage />} />
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
