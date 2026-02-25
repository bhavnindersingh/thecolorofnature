import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'

export default function Account() {
    const [mode, setMode] = useState<'login' | 'signup'>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

    const { data: user, refetch } = useQuery({
        queryKey: ['auth-user'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            return user
        },
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true); setMessage(null)
        try {
            if (mode === 'signup') {
                const { error } = await supabase.auth.signUp({
                    email, password,
                    options: { data: { full_name: name } }
                })
                if (error) throw error
                setMessage({ text: 'Check your email to confirm your account.', type: 'success' })
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) throw error
                refetch()
            }
        } catch (err) {
            setMessage({ text: (err as Error).message, type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        refetch()
    }

    /* ── Signed in ────────────────────────────────────────────────── */
    if (user) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <div className="auth-logo">Color of Nature</div>
                    <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: '0.4rem' }}>
                            Signed in as
                        </div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem' }}>{user.email}</div>
                    </div>
                    <div style={{
                        padding: '1rem', background: 'var(--sage-light)',
                        marginBottom: '2rem', fontSize: '0.82rem',
                        color: 'var(--ink-muted)', lineHeight: 1.7
                    }}>
                        Your orders will appear here once placed. Order history syncs with our Odoo ERP automatically.
                    </div>
                    <button
                        onClick={handleLogout}
                        className="btn btn-outline"
                        style={{ width: '100%', justifyContent: 'center' }}
                    >
                        <LogOut size={14} strokeWidth={1.5} /> Sign Out
                    </button>
                </div>
            </div>
        )
    }

    /* ── Auth form ────────────────────────────────────────────────── */
    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">Color of Nature</div>

                <div className="auth-tabs">
                    <button
                        className={`auth-tab${mode === 'login' ? ' active' : ''}`}
                        onClick={() => setMode('login')}
                    >Sign In</button>
                    <button
                        className={`auth-tab${mode === 'signup' ? ' active' : ''}`}
                        onClick={() => setMode('signup')}
                    >Create Account</button>
                </div>

                <form onSubmit={handleSubmit}>
                    {mode === 'signup' && (
                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <input
                                className="form-input" type="text"
                                placeholder="Your name" value={name}
                                onChange={e => setName(e.target.value)} required
                            />
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            className="form-input" type="email"
                            placeholder="you@example.com" value={email}
                            onChange={e => setEmail(e.target.value)} required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            className="form-input" type="password"
                            placeholder="••••••••" value={password}
                            onChange={e => setPassword(e.target.value)} required
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
                        {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
                    </button>
                </form>
            </div>
        </div>
    )
}
