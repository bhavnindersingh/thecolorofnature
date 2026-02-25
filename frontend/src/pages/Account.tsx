import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Mail, Lock, User, LogOut, Leaf } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

export default function Account() {
    const [mode, setMode] = useState<'login' | 'signup'>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')

    const { data: user, refetch } = useQuery({
        queryKey: ['auth-user'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            return user
        },
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true); setMessage('')
        try {
            if (mode === 'signup') {
                const { error } = await supabase.auth.signUp({
                    email, password,
                    options: { data: { full_name: name } }
                })
                if (error) throw error
                setMessage('✅ Check your email to confirm your account!')
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) throw error
                refetch()
            }
        } catch (err) {
            setMessage(`❌ ${(err as Error).message}`)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        refetch()
    }

    if (user) {
        return (
            <main style={{ paddingTop: 'calc(68px + 3rem)' }}>
                <div className="container" style={{ maxWidth: 520 }}>
                    <div className="auth-card">
                        <div className="auth-logo"><Leaf size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />My Account</div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem' }}>Signed in as</div>
                            <div style={{ fontWeight: 600 }}>{user.email}</div>
                        </div>
                        <div style={{ padding: '1rem', background: 'rgba(163,230,53,0.07)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                            🌿 Your orders will appear here once you place them. Order history syncs with our Odoo ERP automatically.
                        </div>
                        <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={handleLogout}>
                            <LogOut size={16} /> Sign Out
                        </button>
                    </div>
                </div>
            </main>
        )
    }

    return (
        <main>
            <div className="auth-card">
                <div className="auth-logo">🌿 Color of Nature</div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
                    <button className={`btn ${mode === 'login' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMode('login')}>Sign In</button>
                    <button className={`btn ${mode === 'signup' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMode('signup')}>Sign Up</button>
                </div>

                <form onSubmit={handleSubmit}>
                    {mode === 'signup' && (
                        <div className="form-group">
                            <label className="form-label"><User size={13} style={{ verticalAlign: 'middle' }} /> Full Name</label>
                            <input className="form-input" type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required />
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label"><Mail size={13} style={{ verticalAlign: 'middle' }} /> Email</label>
                        <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label"><Lock size={13} style={{ verticalAlign: 'middle' }} /> Password</label>
                        <input className="form-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                    </div>
                    {message && <div style={{ fontSize: '0.85rem', marginBottom: '1rem', color: message.startsWith('✅') ? 'var(--color-primary)' : '#f87171' }}>{message}</div>}
                    <button className="btn btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                        {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
                    </button>
                </form>
            </div>
        </main>
    )
}
