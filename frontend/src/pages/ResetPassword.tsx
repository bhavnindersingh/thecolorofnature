import { useState } from 'react'
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
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

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
            const { error } = await supabase.auth.updateUser({ password })
            if (error) throw error
            setMessage({ text: 'Password updated!', type: 'success' })
        } catch (err) {
            setMessage({ text: mapAuthError((err as Error).message), type: 'error' })
        } finally {
            setLoading(false)
        }
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
                        <Link to="/account" className="btn btn-primary" style={{ display: 'inline-flex' }}>
                            Go to Account
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
