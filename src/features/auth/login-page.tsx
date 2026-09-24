import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/auth-context'
import { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PwaInstallBanner } from '@/components/layout/pwa-install-banner'

export function LoginPage() {
  const { login, token } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (token) return <Navigate to="/quotes" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome back')
      navigate('/quotes')
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Couldn’t sign in'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#e8f4fb_0%,_transparent_55%),radial-gradient(ellipse_at_bottom_right,_#ffe8d6_0%,_transparent_45%)] dark:bg-[radial-gradient(ellipse_at_top,_#1c3344_0%,_transparent_55%)]"
      />
      <PwaInstallBanner className="relative z-10" />
      <div className="relative z-10 flex flex-1 items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Card className="w-full max-w-md border-border/80 shadow-sm">
          <CardHeader className="items-center text-center">
            <img
              src="/image.png"
              alt="DAMAC"
              className="mb-2 mt-1 size-20 rounded-xl object-contain object-center p-2"
            />
            <CardTitle className="text-2xl tracking-tight">Welcome to DAMAC</CardTitle>
            <CardDescription className="max-w-sm">
              Sign in to manage quotes, live chats, and your knowledge base.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button className="h-11 w-full md:h-9" type="submit" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
