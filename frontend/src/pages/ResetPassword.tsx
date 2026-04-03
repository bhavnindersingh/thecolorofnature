import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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

    // Tokens captured from URL so we can re-establish the session right before
    // updateUser (Supabase clears the recovery session via auto-refresh).
    const accessTokenRef = useRef<string | null>(null)
    const refreshTokenRef = useRef<string | null>(null)

    // Guard against React StrictMode running the effect twice.
    const initialized = useRef(false)

    useEffect(() => {
        if (initialized.current) return
        initialized.current = true

        // Check both hash (Implicit) and searchParams (PKCE)
        const hash = new URLSearchParams(window.location.hash.slice(1))
        const query = new URLSearchParams(window.location.search)
        
        const accessToken = hash.get('access_token') || query.get('access_token')
        const refreshToken = hash.get('refresh_token') || query.get('refresh_token')
        const type = hash.get('type') || query.get('type')

        console.log('[ResetPassword] Attempting session recovery with type:', type)

        if (!accessToken || type !== 'recovery') {
            console.warn('[ResetPassword] Invalid reset link parameters')
            setLinkError(true)
            return
        }

        accessTokenRef.current = accessToken
        refreshTokenRef.current = refreshToken

        supabase.auth
            .setSession({ access_token: accessToken, refresh_token: refreshToken ?? '' })
            .then(({ data, error }) => {
                if (error) {
                    console.error('[ResetPassword] setSession error:', error)
                    setLinkError(true)
                } else if (data?.session) {
                    console.log('[ResetPassword] Session recovery successful for:', data.session.user.email)
                    setSessionReady(true)
                    window.history.replaceState({}, '', window.location.pathname)
                }
            })
    }, [])

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
            // Re-establish the session — Supabase's auto-refresh can clear the
            // recovery session between mount and submit.
            if (accessTokenRef.current) {
                const { error: sessErr } = await supabase.auth.setSession({
                    access_token: accessTokenRef.current,
                    refresh_token: refreshTokenRef.current ?? '',
                })
                if (sessErr) throw sessErr
            }
            const { error } = await supabase.auth.updateUser({ password })
            if (error) throw error
            setMessage({ text: 'Password updated! You can now log in.', type: 'success' })
            await supabase.auth.signOut()
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
