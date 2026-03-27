import { useState } from 'react'
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { triggerProductSync } from '../lib/supabase'

type SyncStatus = 'idle' | 'running' | 'success' | 'error'

export default function AdminSync() {
    const [status, setStatus] = useState<SyncStatus>('idle')
    const [log, setLog] = useState<string[]>([])
    const [error, setError] = useState<string | null>(null)
    const [lastSynced, setLastSynced] = useState<Date | null>(null)

    async function handleSync() {
        setStatus('running')
        setLog([])
        setError(null)

        const { data, error: fnError } = await triggerProductSync()

        if (fnError) {
            setStatus('error')
            setError(fnError.message)
            return
        }

        if (data?.success) {
            setStatus('success')
            setLog(data.log ?? [])
            setLastSynced(new Date())
        } else {
            setStatus('error')
            setError(data?.error ?? 'Unknown error')
            setLog(data?.log ?? [])
        }
    }

    return (
        <main style={{ minHeight: '80vh' }}>
            <PageHeader name="Admin" />

            <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1.5rem' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Product Sync
                </h1>
                <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.9rem' }}>
                    Fetches all "Online Shop" tagged products from Odoo and updates Supabase.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button
                        onClick={handleSync}
                        disabled={status === 'running'}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.6rem 1.4rem',
                            background: status === 'running' ? '#999' : '#222',
                            color: '#fff',
                            border: 'none',
                            cursor: status === 'running' ? 'not-allowed' : 'pointer',
                            fontSize: '0.9rem',
                            letterSpacing: '0.05em',
                        }}
                    >
                        <RefreshCw
                            size={15}
                            strokeWidth={1.5}
                            style={{ animation: status === 'running' ? 'spin 1s linear infinite' : 'none' }}
                        />
                        {status === 'running' ? 'Syncing…' : 'Sync Now'}
                    </button>

                    {status === 'success' && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#2a7a2a', fontSize: '0.85rem' }}>
                            <CheckCircle size={15} strokeWidth={1.5} />
                            Done — {lastSynced?.toLocaleTimeString()}
                        </span>
                    )}
                    {status === 'error' && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#b00', fontSize: '0.85rem' }}>
                            <XCircle size={15} strokeWidth={1.5} />
                            Failed
                        </span>
                    )}
                </div>

                {error && (
                    <div style={{ background: '#fff0f0', border: '1px solid #fcc', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#b00' }}>
                        {error}
                    </div>
                )}

                {log.length > 0 && (
                    <pre style={{
                        background: '#111',
                        color: '#d4d4d4',
                        padding: '1rem',
                        fontSize: '0.78rem',
                        lineHeight: 1.6,
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: '60vh',
                        overflowY: 'auto',
                    }}>
                        {log.join('\n')}
                    </pre>
                )}
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </main>
    )
}
