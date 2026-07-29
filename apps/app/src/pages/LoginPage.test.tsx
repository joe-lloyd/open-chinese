import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from './LoginPage'

const { signInWithGoogle } = vi.hoisted(() => ({
  signInWithGoogle: vi.fn<() => Promise<void>>(),
}))

vi.mock('../lib/auth', () => ({
  signInWithGoogle,
}))

describe('LoginPage', () => {
  beforeEach(() => {
    signInWithGoogle.mockReset()
  })

  it('uses public marketing links and truthful product benefits', () => {
    render(<LoginPage />)

    expect(screen.getByRole('link', { name: 'OpenChinese home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Explore features' })).toHaveAttribute(
      'href',
      '/features',
    )
    expect(screen.getByRole('heading', { name: 'Follow a structured HSK path' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Read at the right level' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Practise what needs attention' })).toBeVisible()
    expect(document.body).not.toHaveTextContent(/learners|rating|five-star/i)
  })

  it('disables duplicate submission and communicates pending sign-in', async () => {
    signInWithGoogle.mockImplementation(() => new Promise<void>(() => undefined))
    const user = userEvent.setup()

    render(<LoginPage />)
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))

    expect(signInWithGoogle).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Signing in…' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
  })

  it('keeps the panel visible and announces an actionable sign-in error', async () => {
    signInWithGoogle.mockRejectedValue({ code: 'auth/popup-blocked' })
    const user = userEvent.setup()

    render(<LoginPage />)
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))

    expect(screen.getByRole('heading', { name: 'Sign in to OpenChinese' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.',
    )
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled()
  })

  it('shows a branded non-interactive state while authentication resolves', () => {
    render(<LoginPage authLoading />)

    expect(screen.getByText('OpenChinese')).toBeVisible()
    expect(screen.getByText('Checking your account…')).toHaveAttribute('role', 'status')
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument()
  })
})
