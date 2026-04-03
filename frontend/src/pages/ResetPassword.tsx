import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'

function mapAuthError(msg: string): string {
    if (msg.includes('Password should be at least')) return 'Password must be at least 6 characters.'
    return msg
}

export default function ResetPassword() {
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [loading, setLoading] = useState(false)
    const [sessionReady, setSessionReady] = useState(false)
    const [linkError, setLinkError] = useState(false)
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

    // Guard against React StrictMode running the effect twice.
    const initialized = useRef(false)

    // Dedicated Supabase client with autoRefreshToken: false.
    //
    // Root cause of the original bug: after PASSWORD_RECOVERY fires, the SDK's
    // background auto-refresh timer calls POST /auth/v1/token?grant_type=refresh_token.
    // Supabase rejects this (recovery tokens can't be standard-refreshed), marks the
    // session as revoked server-side, and fires SIGNED_OUT. Any subsequent API call
    // with the access_token then returns 403.
    //
    // Fix: use a client that never starts the auto-refresh timer. The main supabase
    // client has detectSessionInUrl: false so it won't compete on this page.
    const recoveryClient = useMemo(() => createClient(
        import.meta.env.VITE_SUPABASE_URL ?? '',
        import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false,
                // Different storageKey isolates this client from the main supabase
                // client — they won't share BroadcastChannel events, so recovery
                // session changes can't sign out the admin session.
                storageKey: 'sb-recovery-isolated',
            },
        }
    ), [])

    useEffect(() => {
        if (initialized.current) return
        initialized.current = true

        // Support both implicit flow (#access_token=...) and PKCE flow (?code=...)
        const hash = new URLSearchParams(window.location.hash.slice(1))
        const query = new URLSearchParams(window.location.search)

        const accessToken = hash.get('access_token') || query.get('access_token')
        const refreshToken = hash.get('refresh_token') || query.get('refresh_token')
        const type = hash.get('type') || query.get('type')
        const code = query.get('code')

        console.log('[ResetPassword] Recovery params — type:', type, 'hasToken:', !!accessToken, 'hasCode:', !!code)

        if (code) {
            // PKCE flow: exchange the code for a session using the no-refresh client
            recoveryClient.auth
                .exchangeCodeForSession(code)
                .then(({ data, error }) => {
                    if (error || !data.session) {
                        console.error('[ResetPassword] exchangeCodeForSession error:', error)
                        setLinkError(true)
                    } else {
                        console.log('[ResetPassword] Session ready (PKCE) for:', data.session.user.email)
                        setSessionReady(true)
                        window.history.replaceState({}, '', window.location.pathname)
                    }
                })
        } else if (accessToken && type === 'recovery') {
            // Implicit flow: set the session directly — no auto-refresh means no SIGNED_OUT
            recoveryClient.auth
                .setSession({ access_token: accessToken, refresh_token: refreshToken ?? '' })
                .then(({ data, error }) => {
                    if (error || !data.session) {
                        console.error('[ResetPassword] setSession error:', error)
                        setLinkError(true)
                    } else {
                        console.log('[ResetPassword] Session ready (implicit) for:', data.session.user.email)
                        setSessionReady(true)
                        window.history.replaceState({}, '', window.location.pathname)
                    }
                })
        } else {
            console.warn('[ResetPassword] No recovery token or code found in URL')
            setLinkError(true)
        }
    }, [recoveryClient])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirm) {
            setMessage({ text: 'Passwords do not match.', type: 'error' })
            return
        }
        if (password.length < 6) {
            setMessage({ text: 'Password must be at least 6 characters.', type: 'error' })
            return
        }
        setLoading(true)
        setMessage(null)
        try {
            // Session is still alive in recoveryClient — no SIGNED_OUT ever fires
            // because autoRefreshToken is false on this client.
            const { error } = await recoveryClient.auth.updateUser({ password })
            if (error) throw error
            setMessage({ text: 'Password updated! You can now log in.', type: 'success' })
        } catch (err) {
            setMessage({ text: mapAuthError((err as Error).message), type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    if (!sessionReady) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <div className="auth-logo">Color of Nature</div>
                    {linkError ? (
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ color: '#c53030', fontSize: '0.9rem', marginBottom: '1rem' }}>
                                This reset link has expired or already been used.
                            </p>
                            <Link to="/admin" className="btn btn-primary" style={{ display: 'inline-flex' }}>
                                Request a new link
                            </Link>
                        </div>
                    ) : (
                        <p style={{ textAlign: 'center', color: '#8494a7', marginTop: '1rem' }}>Verifying reset link…</p>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">Color of Nature</div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: '1.4rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                    Set New Password
                </h2>

                {message?.type === 'success' ? (
                    <div style={{ textAlign: 'center' }}>
                        <div className="form-message success" style={{ marginBottom: '1.5rem' }}>
                            {message.text}
                        </div>
                        <Link to="/admin" className="btn btn-primary" style={{ display: 'inline-flex' }}>
                            Go to Admin Login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">New Password</label>
                            <input
                                className="form-input"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Confirm Password</label>
                            <input
                                className="form-input"
                                type="password"
                                placeholder="••••••••"
                                value={confirm}
                                onChange={e => setConfirm(e.target.value)}
                                required
                            />
                        </div>

                        {message && (
                            <div className={`form-message ${message.type}`} style={{ marginBottom: '1.25rem' }}>
                                {message.text}
                            </div>
                        )}

                        <button
                            className="btn btn-primary"
                            type="submit"
                            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
                            disabled={loading}
                        >
                            {loading ? 'Updating…' : 'Update Password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}
