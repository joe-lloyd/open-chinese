import { useState } from 'react'
import { signInWithGoogle } from '../lib/auth'

interface Props {
  error?: string | null
  authLoading?: boolean
}

const BENEFITS = [
  {
    character: '级',
    title: 'Follow a structured HSK path',
    body: 'Build from essential vocabulary toward advanced reading without wondering what to study next.',
  },
  {
    character: '读',
    title: 'Read at the right level',
    body: 'Meet familiar words in graded stories, then tap any word when you need a little help.',
  },
  {
    character: '习',
    title: 'Practise what needs attention',
    body: 'Progress-aware reviews bring back the words and skills that are due, across all your devices.',
  },
] as const

type FirebaseErrorLike = {
  code?: string
  message?: string
}

function getSignInErrorMessage(error: unknown): string {
  const authError = error as FirebaseErrorLike

  switch (authError?.code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled. You can try again when you’re ready.'
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.'
    case 'auth/network-request-failed':
      return 'We couldn’t reach Google. Check your connection and try again.'
    default:
      return authError?.message || 'Sign-in failed. Please try again.'
  }
}

function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2 font-semibold text-text-primary">
      <span aria-hidden="true" className="text-2xl leading-none text-accent">
        中
      </span>
      <span>OpenChinese</span>
    </span>
  )
}

function LoginHeader() {
  return (
    <header className="relative z-10 border-b border-border/80 bg-surface/80 backdrop-blur-sm">
      <nav
        aria-label="Login"
        className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4"
      >
        <a
          href="/"
          aria-label="OpenChinese home"
          className="inline-flex min-h-11 items-center rounded-lg px-1 transition-opacity hover:opacity-80"
        >
          <BrandMark />
        </a>
        <div className="flex items-center gap-1">
          <a
            href="/features"
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-text-muted transition-colors hover:text-text-primary"
          >
            Explore features
          </a>
          <a
            href="/"
            className="hidden min-h-11 items-center rounded-lg px-3 text-sm text-text-muted transition-colors hover:text-text-primary sm:inline-flex"
          >
            Back to home
          </a>
        </div>
      </nav>
    </header>
  )
}

function ProductIntroduction() {
  return (
    <section className="relative z-10 max-w-2xl self-end lg:pr-8">
      <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent">
        <span aria-hidden="true">学习</span>
        Learn Mandarin that sticks
      </p>
      <h1 className="max-w-xl text-4xl font-bold leading-[1.08] tracking-tight text-text-primary sm:text-5xl lg:text-6xl">
        Pick up where your Chinese left off.
      </h1>
      <p className="mt-5 max-w-xl text-base leading-7 text-text-muted sm:text-lg">
        One focused place to learn HSK vocabulary, practise what is due, and turn those
        words into reading confidence.
      </p>
    </section>
  )
}

function ProductBenefits() {
  return (
    <section aria-label="What you can learn" className="relative z-10 grid gap-3 self-start lg:pr-8">
      {BENEFITS.map((benefit) => (
        <article
          key={benefit.title}
          className="flex gap-4 rounded-2xl border border-border/80 bg-surface/75 p-4 backdrop-blur-sm"
        >
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-lg font-semibold text-accent"
          >
            {benefit.character}
          </span>
          <div>
            <h2 className="font-semibold text-text-primary">{benefit.title}</h2>
            <p className="mt-1 text-sm leading-6 text-text-muted">{benefit.body}</p>
          </div>
        </article>
      ))}
    </section>
  )
}

function GoogleIcon() {
  return (
    <span
      aria-hidden="true"
      className="flex size-7 items-center justify-center rounded-full bg-white"
    >
      <svg width="17" height="17" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.8 2.4 30.2 0 24 0 14.6 0 6.6 5.5 2.6 13.5l7.9 6.1C12.4 13.2 17.8 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 6.9-10 6.9-17z" />
        <path fill="#FBBC05" d="M10.5 28.4A14.8 14.8 0 0 1 9.5 24c0-1.5.3-3 .8-4.4l-7.9-6.1A23.9 23.9 0 0 0 0 24c0 3.8.9 7.4 2.6 10.5l7.9-6.1z" />
        <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.2 0-11.5-4.2-13.4-9.9l-7.9 6.1C6.6 42.5 14.6 48 24 48z" />
      </svg>
    </span>
  )
}

function InlineSpinner() {
  return (
    <span
      aria-hidden="true"
      className="size-5 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  )
}

function AuthPanel({
  authLoading,
  displayError,
  onSignIn,
  signingIn,
}: {
  authLoading: boolean
  displayError: string | null
  onSignIn: () => void
  signingIn: boolean
}) {
  const statusId = 'sign-in-status'

  return (
    <section className="relative z-10 self-center lg:col-start-2 lg:row-span-2 lg:row-start-1">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-surface-raised p-6 shadow-2xl shadow-accent/10 sm:p-8">
        <div className="mb-7 flex size-14 items-center justify-center rounded-2xl bg-accent/10 text-3xl text-accent">
          <span aria-hidden="true">开</span>
        </div>
        <p className="text-sm font-medium text-accent">Your learning continues here</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
          Sign in to OpenChinese
        </h2>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          Your vocabulary, review schedule, and reading progress stay in sync wherever you
          study.
        </p>

        <div className="mt-7">
          {authLoading ? (
            <div
              role="status"
              aria-live="polite"
              className="flex min-h-12 items-center justify-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-text-muted"
            >
              <InlineSpinner />
              Checking your account…
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              disabled={signingIn}
              aria-describedby={displayError ? statusId : undefined}
              aria-busy={signingIn}
              className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-accent-solid px-4 py-3 text-sm font-semibold text-on-accent shadow-lg shadow-accent/20 transition hover:-translate-y-0.5 hover:opacity-95 disabled:cursor-wait disabled:opacity-70"
            >
              {signingIn ? <InlineSpinner /> : <GoogleIcon />}
              {signingIn ? 'Signing in…' : 'Continue with Google'}
            </button>
          )}

          <div
            id={statusId}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={
              displayError
                ? 'mt-4 rounded-xl border border-incorrect/30 bg-incorrect/10 px-4 py-3 text-sm leading-5 text-incorrect'
                : 'sr-only'
            }
          >
            {displayError ?? ''}
          </div>
        </div>

        <div className="my-6 h-px bg-border" />
        <p className="text-center text-xs leading-5 text-text-muted">
          No card required. Start with HSK 1 for free, with no time limit.
        </p>
      </div>
    </section>
  )
}

/**
 * The seam between the public site and the authenticated product. The links are
 * ordinary anchors because the marketing site owns the domain root, outside
 * this router's `/app` basename.
 */
export default function LoginPage({ error, authLoading = false }: Props) {
  const [signingIn, setSigningIn] = useState(false)
  const [signInError, setSignInError] = useState<string | null>(null)

  async function handleSignIn() {
    setSigningIn(true)
    setSignInError(null)
    try {
      await signInWithGoogle()
    } catch (signInFailure) {
      setSignInError(getSignInErrorMessage(signInFailure))
      setSigningIn(false)
    }
  }

  const displayError = error ?? signInError

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-surface">
      <div
        aria-hidden="true"
        className="login-hanzi pointer-events-none absolute -left-16 top-24 select-none text-[15rem] font-bold leading-none text-accent/[0.035] sm:text-[22rem]"
      >
        读
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 bottom-0 size-[30rem] rounded-full bg-accent/[0.06] blur-3xl"
      />

      <LoginHeader />
      <main className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-5 sm:py-14 lg:min-h-[calc(100vh-77px)] lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.82fr)] lg:grid-rows-[auto_auto] lg:content-center lg:gap-x-14 lg:gap-y-8 lg:py-16">
        <ProductIntroduction />
        <AuthPanel
          authLoading={authLoading}
          displayError={displayError}
          onSignIn={handleSignIn}
          signingIn={signingIn}
        />
        <ProductBenefits />
      </main>
    </div>
  )
}
