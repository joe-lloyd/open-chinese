import { useState } from 'react'
import { signInWithGoogle } from '../lib/auth'

interface Props {
  error?: string | null
}

export default function LoginPage({ error }: Props) {
  const [signingIn, setSigningIn] = useState(false)
  const [signInError, setSignInError] = useState<string | null>(null)

  async function handleSignIn() {
    setSigningIn(true)
    setSignInError(null)
    try {
      await signInWithGoogle()
    } catch (e) {
      setSignInError((e as Error).message ?? 'Sign-in failed. Please try again.')
      setSigningIn(false)
    }
  }

  const displayError = error ?? signInError

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm text-center space-y-8">
        <div>
          <span className="text-6xl font-light text-text-primary">开</span>
          <h1 className="text-2xl font-bold text-text-primary mt-2">OpenChinese</h1>
          <p className="text-text-muted text-sm mt-1">Personal Mandarin study</p>
        </div>

        {displayError && (
          <div className="bg-incorrect/10 border border-incorrect/30 rounded-xl px-4 py-3 text-sm text-incorrect">
            {displayError}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={signingIn}
          className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl border border-border bg-surface-raised hover:bg-surface hover:border-accent/50 transition-colors text-text-primary font-medium text-sm disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.8 2.4 30.2 0 24 0 14.6 0 6.6 5.5 2.6 13.5l7.9 6.1C12.4 13.2 17.8 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 6.9-10 6.9-17z"/>
            <path fill="#FBBC05" d="M10.5 28.4A14.8 14.8 0 0 1 9.5 24c0-1.5.3-3 .8-4.4l-7.9-6.1A23.9 23.9 0 0 0 0 24c0 3.8.9 7.4 2.6 10.5l7.9-6.1z"/>
            <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.2 0-11.5-4.2-13.4-9.9l-7.9 6.1C6.6 42.5 14.6 48 24 48z"/>
          </svg>
          {signingIn ? 'Signing in…' : 'Continue with Google'}
        </button>
      </div>
    </div>
  )
}
