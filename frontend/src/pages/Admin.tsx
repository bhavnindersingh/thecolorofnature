import { useState, useEffect, useCallback } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import {
    RefreshCw, LogOut, ChevronDown, ChevronUp,
    CheckCircle, XCircle, AlertTriangle, Truck, Clock, Package, FileText, Search
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
type ReturnStatus = 'pending' | 'approved' | 'item_shipped' | 'item_received' | 'rejected' | 'completed'

interface AdminReturnRequest {
    id: string
    status: ReturnStatus
    reason: string
    admin_note: string | null
    return_instructions: string | null
    odoo_return_id: number | null
    created_at: string
    updated_at: string
}

interface EventLogEntry {
    id: number
    event_type: string
    entity_type: string
    entity_id: string | null
    details: Record<string, unknown>
    actor: string
    created_at: string
}

interface AdminOrder {
    id: string
    status: OrderStatus
    total_amount: number
    shipping_address: Record<string, string> | null
    odoo_order_id: number | null
    tracking_number: string | null
    carrier: string | null
    estimated_delivery: string | null
    odoo_picking_name: string | null
    created_at: string
    updated_at: string
    user_id: string
    customer_email: string | null
    order_items: Array<{
        id: number
        quantity: number
        unit_price: number
        product: { id: number; name: string; image_url: string | null } | null
    }>
    return_requests: AdminReturnRequest[]
    profile: {
        full_name: string | null
        first_name: string | null
        last_name: string | null
        phone: string | null
    } | null
}

type Tab = 'all' | 'failed_odoo' | 'pending_returns' | 'event_log'
type InlineForm = 'status' | 'tracking' | 'confirm_cancel' | 'return' | 'sync_log' | null

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_KEY = 'admin_pin'

const STATUS_OPTIONS: OrderStatus[] = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled']
const STATUS_LABELS: Record<OrderStatus, string> = {
    pending: 'Pending', paid: 'Paid', processing: 'Processing',
    shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
}
const STATUS_ICONS: Record<OrderStatus, React.ReactNode> = {
    pending: <Clock size={13} strokeWidth={1.5} />,
    paid: <CheckCircle size={13} strokeWidth={1.5} />,
    processing: <Package size={13} strokeWidth={1.5} />,
    shipped: <Truck size={13} strokeWidth={1.5} />,
    delivered: <CheckCircle size={13} strokeWidth={1.5} />,
    cancelled: <XCircle size={13} strokeWidth={1.5} />,
}

// ─── Admin API helper ─────────────────────────────────────────────────────────

function getPin() {
    return sessionStorage.getItem(SESSION_KEY) ?? ''
}

async function adminCall<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
    const pin = getPin()
    const { data, error } = await supabase.functions.invoke('admin', {
        body: { action, payload },
        headers: { Authorization: `Bearer ${pin}` },
    })
    if (error) {
        // FunctionsHttpError wraps the 401
        const msg = (error as { message?: string }).message ?? 'Request failed'
        if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
            sessionStorage.removeItem(SESSION_KEY)
            window.location.reload()
        }
        throw new Error(msg)
    }
    if (data?.error) throw new Error(data.error)
    return data as T
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function customerName(order: AdminOrder) {
    const p = order.profile
    if (!p) return order.customer_email ?? '—'
    return (p.full_name ?? [p.first_name, p.last_name].filter(Boolean).join(' ')) || (order.customer_email ?? '—')
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtAmount(n: number) {
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function shortId(id: string) {
    return '#' + id.replace(/-/g, '').slice(0, 8).toUpperCase()
}

// ─── PIN Gate ─────────────────────────────────────────────────────────────────

function PinGate({ onAuth }: { onAuth: () => void }) {
    const [pin, setPin] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            sessionStorage.setItem(SESSION_KEY, pin)
            await adminCall('validate_pin')
            onAuth()
        } catch {
            sessionStorage.removeItem(SESSION_KEY)
            setError('Incorrect PIN. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg)',
        }}>
            <div style={{
                width: 320, background: 'var(--surface)', border: '1px solid var(--border)',
                padding: '2.5rem 2rem', textAlign: 'center',
            }}>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontWeight: 400, marginBottom: '0.25rem' }}>
                    Admin Access
                </h1>
                <p style={{ color: 'var(--ink-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
                    The Colours of Nature
                </p>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input
                        type="password"
                        value={pin}
                        onChange={e => setPin(e.target.value)}
                        placeholder="Enter PIN"
                        className="form-input"
                        autoFocus
                        style={{ textAlign: 'center', letterSpacing: '0.2em' }}
                    />
                    {error && (
                        <p style={{ color: '#b00', fontSize: '0.82rem', margin: 0 }}>{error}</p>
                    )}
                    <button type="submit" className="btn btn-primary" disabled={loading || !pin}>
                        {loading ? 'Verifying…' : 'Enter'}
                    </button>
                </form>
            </div>
        </div>
    )
}

// ─── Order Row ────────────────────────────────────────────────────────────────

function OrderRow({ order, onRefresh }: { order: AdminOrder; onRefresh: () => void }) {
    const [expanded, setExpanded] = useState(false)
    const [activeForm, setActiveForm] = useState<InlineForm>(null)
    const [statusVal, setStatusVal] = useState<OrderStatus>(order.status)
    const [statusNote, setStatusNote] = useState('')
    const [carrier, setCarrier] = useState(order.carrier ?? '')
    const [trackingNum, setTrackingNum] = useState(order.tracking_number ?? '')
    const [estDelivery, setEstDelivery] = useState(order.estimated_delivery ?? '')
    const [returnNote, setReturnNote] = useState('')
    const [returnInstructions, setReturnInstructions] = useState('')
    const [syncLog, setSyncLog] = useState<string[]>([])
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

    const hasActiveReturn = order.return_requests.some(r => !['completed', 'rejected'].includes(r.status))

    function showMsg(text: string, ok: boolean) {
        setMsg({ text, ok })
        setTimeout(() => setMsg(null), 4000)
    }

    async function run(fn: () => Promise<void>) {
        setBusy(true)
        setMsg(null)
        try {
            await fn()
            onRefresh()
        } catch (e) {
            showMsg((e as Error).message, false)
        } finally {
            setBusy(false)
        }
    }

    async function handleUpdateStatus() {
        await run(async () => {
            await adminCall('update_order_status', { order_id: order.id, status: statusVal, note: statusNote || undefined })
            setActiveForm(null)
            showMsg('Status updated.', true)
        })
    }

    async function handleUpdateTracking() {
        await run(async () => {
            await adminCall('update_tracking', {
                order_id: order.id,
                tracking_number: trackingNum,
                carrier,
                estimated_delivery: estDelivery || undefined,
            })
            setActiveForm(null)
            showMsg('Tracking saved.', true)
        })
    }

    async function handlePushToOdoo() {
        await run(async () => {
            const res = await adminCall<{ success: boolean; odoo_order_id?: number; message?: string }>('push_to_odoo', { order_id: order.id })
            showMsg(res.message ?? `Pushed to Odoo — ID ${res.odoo_order_id}`, true)
        })
    }

    async function handleCancel() {
        await run(async () => {
            await adminCall('cancel_order', { order_id: order.id })
            setActiveForm(null)
            showMsg('Order cancelled.', true)
        })
    }

    async function handleReturn(action: 'approve' | 'reject', returnId: string) {
        await run(async () => {
            await adminCall('handle_return', {
                return_request_id: returnId,
                action,
                admin_note: returnNote || undefined,
                return_instructions: action === 'approve' ? (returnInstructions || undefined) : undefined,
            })
            setActiveForm(null)
            setReturnNote('')
            setReturnInstructions('')
            showMsg(`Return ${action}d.`, true)
        })
    }

    async function handleMarkReturnReceived(returnId: string) {
        await run(async () => {
            await adminCall('mark_return_received', { return_request_id: returnId })
            showMsg('Return marked as received. Odoo stock return created.', true)
        })
    }

    async function handleCompleteReturn(returnId: string) {
        await run(async () => {
            await adminCall('complete_return', { return_request_id: returnId })
            showMsg('Return completed.', true)
        })
    }

    async function handleSyncProducts() {
        setBusy(true)
        try {
            const res = await adminCall<{ success: boolean; log?: string[] }>('sync_products')
            setSyncLog(res.log ?? [])
            setActiveForm('sync_log')
        } catch (e) {
            showMsg((e as Error).message, false)
        } finally {
            setBusy(false)
        }
    }
    // suppress unused – handleSyncProducts is used elsewhere
    void handleSyncProducts

    const odooSynced = !!order.odoo_order_id
    const canPushToOdoo = !odooSynced && ['paid', 'processing'].includes(order.status)
    const canCancel = ['pending', 'paid', 'processing'].includes(order.status)
    const canAddTracking = ['paid', 'processing'].includes(order.status)
    const canMarkDelivered = order.status === 'shipped'

    return (
        <div style={{ borderBottom: '1px solid var(--border)' }}>
            {/* ── Row ── */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '110px 1fr 90px 140px 90px 100px 60px 130px',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    cursor: 'pointer',
                    background: expanded ? 'var(--bg-alt)' : 'var(--surface)',
                    gap: '0.5rem',
                }}
                onClick={() => setExpanded(v => !v)}
            >
                <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--ink-mid)' }}>
                    {shortId(order.id)}
                </span>

                <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {customerName(order)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {order.customer_email}
                    </div>
                </div>

                <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>{fmtDate(order.created_at)}</span>

                <span style={{ fontSize: '0.82rem', color: 'var(--ink-mid)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {order.order_items.length} item{order.order_items.length !== 1 ? 's' : ''}
                    {order.order_items[0]?.product ? ` · ${order.order_items[0].product.name}` : ''}
                </span>

                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{fmtAmount(order.total_amount)}</span>

                <span className={`status-badge badge-${order.status}`} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
                    {STATUS_ICONS[order.status]} {STATUS_LABELS[order.status]}
                </span>

                <span title={odooSynced ? `Odoo #${order.odoo_order_id}` : 'Not synced to Odoo'}>
                    {odooSynced
                        ? <CheckCircle size={15} strokeWidth={1.5} color="#2a7a2a" />
                        : <AlertTriangle size={15} strokeWidth={1.5} color="#8a6a00" />}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={e => e.stopPropagation()}>
                    {canPushToOdoo && (
                        <button
                            className="btn btn-sm"
                            disabled={busy}
                            onClick={handlePushToOdoo}
                            style={{ background: '#fdf3dc', color: '#8a6a00', border: '1px solid #e6cfa0', fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
                        >
                            Push Odoo
                        </button>
                    )}
                    {hasActiveReturn && (
                        <span style={{ fontSize: '0.7rem', background: '#fde8e8', color: '#8c3a3a', padding: '0.15rem 0.4rem', border: '1px solid #f5b8b8' }}>
                            Return
                        </span>
                    )}
                    {expanded ? <ChevronUp size={14} strokeWidth={1.5} color="var(--ink-muted)" /> : <ChevronDown size={14} strokeWidth={1.5} color="var(--ink-muted)" />}
                </div>
            </div>

            {/* ── Expanded detail ── */}
            {expanded && (
                <div style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                    {msg && (
                        <div style={{ padding: '0.5rem 0.75rem', background: msg.ok ? '#edf5ed' : '#fde8e8', color: msg.ok ? '#2a5f2a' : '#8c3a3a', fontSize: '0.82rem', border: `1px solid ${msg.ok ? '#b6d9b6' : '#f5b8b8'}` }}>
                            {msg.text}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

                        {/* Items */}
                        <div>
                            <h4 style={sectionHead}>Items</h4>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--ink-muted)' }}>
                                        <th style={th}>Product</th>
                                        <th style={{ ...th, textAlign: 'right' }}>Qty</th>
                                        <th style={{ ...th, textAlign: 'right' }}>Price</th>
                                        <th style={{ ...th, textAlign: 'right' }}>Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.order_items.map(item => (
                                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={td}>{item.product?.name ?? '—'}</td>
                                            <td style={{ ...td, textAlign: 'right' }}>{item.quantity}</td>
                                            <td style={{ ...td, textAlign: 'right' }}>{fmtAmount(item.unit_price)}</td>
                                            <td style={{ ...td, textAlign: 'right' }}>{fmtAmount(item.quantity * item.unit_price)}</td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td colSpan={3} style={{ ...td, textAlign: 'right', fontWeight: 600 }}>Total</td>
                                        <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{fmtAmount(order.total_amount)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Shipping */}
                        <div>
                            <h4 style={sectionHead}>Shipping Address</h4>
                            {order.shipping_address ? (
                                <address style={{ fontStyle: 'normal', fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--ink-mid)' }}>
                                    {[
                                        [order.shipping_address.first_name, order.shipping_address.last_name].filter(Boolean).join(' '),
                                        order.shipping_address.address_line_1,
                                        order.shipping_address.address_line_2,
                                        [order.shipping_address.city, order.shipping_address.state, order.shipping_address.postal_code].filter(Boolean).join(', '),
                                        order.shipping_address.country,
                                        order.shipping_address.phone,
                                    ].filter(Boolean).map((line, i) => <span key={i}>{line}<br /></span>)}
                                </address>
                            ) : <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>—</p>}

                            {order.tracking_number && (
                                <div style={{ marginTop: '0.75rem', fontSize: '0.82rem' }}>
                                    <strong>Tracking:</strong> {order.carrier} — {order.tracking_number}
                                    {order.estimated_delivery && <><br /><strong>Est. delivery:</strong> {order.estimated_delivery}</>}
                                </div>
                            )}
                            {order.odoo_order_id && (
                                <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                                    Odoo SO: <strong>#{order.odoo_order_id}</strong>
                                    {order.odoo_picking_name && <> · Picking: <strong>{order.odoo_picking_name}</strong></>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Action buttons ── */}
                    <div>
                        <h4 style={sectionHead}>Actions</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <button className="btn btn-sm btn-outline" onClick={() => setActiveForm(f => f === 'status' ? null : 'status')}>Update Status</button>
                            {canAddTracking && <button className="btn btn-sm btn-outline" onClick={() => setActiveForm(f => f === 'tracking' ? null : 'tracking')}>Add Tracking</button>}
                            {canMarkDelivered && (
                                <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => run(async () => { await adminCall('update_order_status', { order_id: order.id, status: 'delivered' }); showMsg('Marked as delivered.', true) })}>
                                    Mark Delivered
                                </button>
                            )}
                            {canPushToOdoo && (
                                <button className="btn btn-sm" disabled={busy} onClick={handlePushToOdoo} style={{ background: '#fdf3dc', color: '#8a6a00', border: '1px solid #e6cfa0' }}>
                                    Push to Odoo
                                </button>
                            )}
                            {canCancel && <button className="btn btn-sm btn-ghost" disabled={busy} style={{ color: '#8c3a3a' }} onClick={() => setActiveForm(f => f === 'confirm_cancel' ? null : 'confirm_cancel')}>Cancel Order</button>}
                        </div>
                    </div>

                    {/* ── Inline: status update ── */}
                    {activeForm === 'status' && (
                        <InlinePanel title="Update Status" onClose={() => setActiveForm(null)}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select className="form-input" value={statusVal} onChange={e => setStatusVal(e.target.value as OrderStatus)}>
                                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Note (optional)</label>
                                <textarea className="form-input" rows={2} value={statusNote} onChange={e => setStatusNote(e.target.value)} placeholder="Reason for status change…" />
                            </div>
                            <button className="btn btn-primary btn-sm" disabled={busy} onClick={handleUpdateStatus}>
                                {busy ? 'Saving…' : 'Save Status'}
                            </button>
                        </InlinePanel>
                    )}

                    {/* ── Inline: tracking ── */}
                    {activeForm === 'tracking' && (
                        <InlinePanel title="Add Tracking" onClose={() => setActiveForm(null)}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Carrier</label>
                                    <input className="form-input" value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="DTDC, Blue Dart…" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tracking Number</label>
                                    <input className="form-input" value={trackingNum} onChange={e => setTrackingNum(e.target.value)} placeholder="AWB123456" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Estimated Delivery</label>
                                    <input className="form-input" type="date" value={estDelivery} onChange={e => setEstDelivery(e.target.value)} />
                                </div>
                            </div>
                            <button className="btn btn-primary btn-sm" disabled={busy || !carrier || !trackingNum} onClick={handleUpdateTracking}>
                                {busy ? 'Saving…' : 'Save Tracking'}
                            </button>
                        </InlinePanel>
                    )}

                    {/* ── Inline: cancel confirm ── */}
                    {activeForm === 'confirm_cancel' && (
                        <InlinePanel title="Cancel Order" onClose={() => setActiveForm(null)}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--ink-mid)', margin: '0 0 0.75rem' }}>
                                Are you sure you want to cancel {shortId(order.id)}?
                                {order.odoo_order_id && ' This will also cancel the order in Odoo.'}
                            </p>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-sm" disabled={busy} onClick={handleCancel} style={{ background: '#8c3a3a', color: '#fff', border: 'none' }}>
                                    {busy ? 'Cancelling…' : 'Yes, Cancel'}
                                </button>
                                <button className="btn btn-sm btn-ghost" onClick={() => setActiveForm(null)}>No</button>
                            </div>
                        </InlinePanel>
                    )}

                    {/* ── Return requests ── */}
                    {order.return_requests.length > 0 && (
                        <div>
                            <h4 style={sectionHead}>Return Requests</h4>
                            {order.return_requests.map(r => {
                                const RETURN_STATUS_LABELS: Record<string, string> = {
                                    pending: 'Pending', approved: 'Approved', item_shipped: 'Item Shipped',
                                    item_received: 'Item Received', rejected: 'Rejected', completed: 'Completed',
                                }
                                return (
                                    <div key={r.id} style={{ border: '1px solid var(--border)', padding: '0.75rem 1rem', marginBottom: '0.5rem', fontSize: '0.82rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                            <span className={`status-badge badge-${r.status === 'item_shipped' ? 'shipped' : r.status === 'item_received' ? 'processing' : r.status}`}>
                                                {RETURN_STATUS_LABELS[r.status] ?? r.status}
                                            </span>
                                            <span style={{ color: 'var(--ink-muted)' }}>{fmtDate(r.created_at)}</span>
                                        </div>
                                        <p style={{ margin: '0 0 0.4rem', color: 'var(--ink-mid)' }}><strong>Reason:</strong> {r.reason}</p>
                                        {r.admin_note && <p style={{ margin: '0 0 0.4rem', color: 'var(--ink-mid)' }}><strong>Admin note:</strong> {r.admin_note}</p>}
                                        {r.return_instructions && <p style={{ margin: '0 0 0.4rem', color: 'var(--ink-mid)' }}><strong>Instructions sent:</strong> {r.return_instructions}</p>}
                                        {r.odoo_return_id && <p style={{ margin: '0', color: 'var(--ink-muted)' }}>Odoo return ID: {r.odoo_return_id}</p>}

                                        {/* Pending: approve/reject */}
                                        {r.status === 'pending' && (
                                            <>
                                                {activeForm === 'return' ? (
                                                    <InlinePanel title="Handle Return" onClose={() => setActiveForm(null)}>
                                                        <div className="form-group">
                                                            <label className="form-label">Return Instructions (sent to customer via email)</label>
                                                            <textarea className="form-input" rows={3} value={returnInstructions} onChange={e => setReturnInstructions(e.target.value)} placeholder="Ship the item to: ... Please include the original packaging." />
                                                        </div>
                                                        <div className="form-group">
                                                            <label className="form-label">Admin Note (optional, internal)</label>
                                                            <textarea className="form-input" rows={2} value={returnNote} onChange={e => setReturnNote(e.target.value)} placeholder="Internal note…" />
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => handleReturn('approve', r.id)}>
                                                                {busy ? 'Processing…' : 'Approve & Send Email'}
                                                            </button>
                                                            <button className="btn btn-sm btn-ghost" disabled={busy} style={{ color: '#8c3a3a' }} onClick={() => handleReturn('reject', r.id)}>
                                                                Reject
                                                            </button>
                                                        </div>
                                                    </InlinePanel>
                                                ) : (
                                                    <button className="btn btn-sm btn-outline" style={{ marginTop: '0.5rem' }} onClick={() => setActiveForm('return')}>
                                                        Handle Return
                                                    </button>
                                                )}
                                            </>
                                        )}

                                        {/* Approved: waiting for customer to ship */}
                                        {r.status === 'approved' && (
                                            <div style={{ marginTop: '0.5rem', color: 'var(--ink-muted)', fontSize: '0.8rem' }}>
                                                Waiting for customer to ship the item back.
                                            </div>
                                        )}

                                        {/* Item shipped: admin can mark received */}
                                        {r.status === 'item_shipped' && (
                                            <button
                                                className="btn btn-sm btn-primary"
                                                style={{ marginTop: '0.5rem' }}
                                                disabled={busy}
                                                onClick={() => handleMarkReturnReceived(r.id)}
                                            >
                                                {busy ? 'Processing…' : 'Mark as Received'}
                                            </button>
                                        )}

                                        {/* Item received: admin can complete */}
                                        {r.status === 'item_received' && (
                                            <button
                                                className="btn btn-sm btn-primary"
                                                style={{ marginTop: '0.5rem' }}
                                                disabled={busy}
                                                onClick={() => handleCompleteReturn(r.id)}
                                            >
                                                {busy ? 'Processing…' : 'Complete Return'}
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* ── Sync log (if visible) ── */}
                    {activeForm === 'sync_log' && syncLog.length > 0 && (
                        <InlinePanel title="Sync Log" onClose={() => setActiveForm(null)}>
                            <pre style={{ background: '#111', color: '#d4d4d4', padding: '0.75rem', fontSize: '0.75rem', maxHeight: '200px', overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap' }}>
                                {syncLog.join('\n')}
                            </pre>
                        </InlinePanel>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Inline panel helper ──────────────────────────────────────────────────────

function InlinePanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.85rem' }}>{title}</strong>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', fontSize: '1rem' }}>×</button>
            </div>
            {children}
        </div>
    )
}

// ─── Event Log Panel ─────────────────────────────────────────────────────────

function EventLogPanel() {
    const [entityFilter, setEntityFilter] = useState('')
    const [searchId, setSearchId] = useState('')

    const { data: events = [], isLoading, refetch } = useQuery({
        queryKey: ['admin-events', entityFilter, searchId],
        queryFn: async () => {
            const payload: Record<string, unknown> = { limit: 100 }
            if (entityFilter) payload.entity_type = entityFilter
            if (searchId.trim()) payload.entity_id = searchId.trim()
            const res = await adminCall<{ success: boolean; events: EventLogEntry[] }>('list_events', payload)
            return res.events
        },
        staleTime: 15_000,
    })

    const EVENT_TYPE_COLORS: Record<string, string> = {
        'order': '#3a6a3a',
        'return': '#6a3a6a',
        'webhook': '#3a3a6a',
        'product_sync': '#6a5a3a',
    }

    function eventColor(entityType: string) {
        return EVENT_TYPE_COLORS[entityType] ?? 'var(--ink-mid)'
    }

    return (
        <div style={{ padding: '1.25rem 0' }}>
            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Search size={14} color="var(--ink-muted)" />
                    <input
                        className="form-input"
                        style={{ width: 220, fontSize: '0.82rem', padding: '0.35rem 0.5rem' }}
                        placeholder="Search by entity ID..."
                        value={searchId}
                        onChange={e => setSearchId(e.target.value)}
                    />
                </div>
                <select
                    className="form-input"
                    style={{ width: 160, fontSize: '0.82rem', padding: '0.35rem 0.5rem' }}
                    value={entityFilter}
                    onChange={e => setEntityFilter(e.target.value)}
                >
                    <option value="">All Types</option>
                    <option value="order">Orders</option>
                    <option value="return">Returns</option>
                    <option value="product_sync">Product Sync</option>
                </select>
                <button onClick={() => refetch()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)' }} title="Refresh">
                    <RefreshCw size={14} strokeWidth={1.5} />
                </button>
            </div>

            {isLoading && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.85rem' }}>
                    Loading events...
                </div>
            )}

            {!isLoading && events.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.85rem' }}>
                    No events found.
                </div>
            )}

            {!isLoading && events.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    {events.map(event => (
                        <div key={event.id} style={{ borderBottom: '1px solid var(--border)', padding: '0.65rem 1rem', fontSize: '0.82rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                            <span style={{ color: 'var(--ink-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap', minWidth: 120 }}>
                                {new Date(event.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span style={{
                                fontSize: '0.7rem', padding: '0.1rem 0.4rem', border: `1px solid ${eventColor(event.entity_type)}40`,
                                color: eventColor(event.entity_type), background: `${eventColor(event.entity_type)}10`,
                                whiteSpace: 'nowrap',
                            }}>
                                {event.event_type}
                            </span>
                            {event.entity_id && (
                                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                                    {event.entity_id.slice(0, 8)}
                                </span>
                            )}
                            <span style={{ color: 'var(--ink-mid)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {Object.entries(event.details)
                                    .filter(([, v]) => v != null && v !== '')
                                    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                                    .join(' | ') || '—'}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
                                {event.actor}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Shared micro-styles ──────────────────────────────────────────────────────

const sectionHead: React.CSSProperties = {
    fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'var(--ink-muted)', margin: '0 0 0.5rem',
}
const th: React.CSSProperties = { padding: '0.3rem 0.5rem', fontWeight: 500, textAlign: 'left' }
const td: React.CSSProperties = { padding: '0.35rem 0.5rem' }

// ─── Dashboard ────────────────────────────────────────────────────────────────

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
    const [activeTab, setActiveTab] = useState<Tab>('all')
    const [syncBusy, setSyncBusy] = useState(false)
    const [syncLog, setSyncLog] = useState<string[]>([])
    const [showSyncLog, setShowSyncLog] = useState(false)
    const queryClient = useQueryClient()

    const { data: orders = [], isLoading, isError, refetch } = useQuery({
        queryKey: ['admin-orders', activeTab],
        queryFn: async () => {
            const filter = activeTab === 'all' ? undefined : activeTab
            const res = await adminCall<{ success: boolean; orders: AdminOrder[] }>('list_orders', { filter })
            return res.orders
        },
        staleTime: 30_000,
        refetchOnWindowFocus: true,
    })

    const handleRefresh = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
    }, [queryClient])

    const displayOrders = activeTab === 'pending_returns'
        ? orders.filter(o => o.return_requests.some(r => !['completed', 'rejected'].includes(r.status)))
        : orders

    async function handleSyncProducts() {
        setSyncBusy(true)
        try {
            const res = await adminCall<{ success: boolean; log?: string[] }>('sync_products')
            setSyncLog(res.log ?? [])
            setShowSyncLog(true)
        } catch (e) {
            alert((e as Error).message)
        } finally {
            setSyncBusy(false)
        }
    }

    const tabs: { id: Tab; label: string; count?: number }[] = [
        { id: 'all', label: 'All Orders', count: orders.length },
        { id: 'failed_odoo', label: 'Failed Syncs', count: activeTab === 'failed_odoo' ? orders.length : undefined },
        { id: 'pending_returns', label: 'Active Returns', count: orders.filter(o => o.return_requests.some(r => !['completed', 'rejected'].includes(r.status))).length || undefined },
        { id: 'event_log', label: 'Event Log' },
    ]

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            {/* ── Header ── */}
            <div style={{ background: 'var(--ink)', color: '#fff', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px', position: 'sticky', top: 72, zIndex: 100 }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', letterSpacing: '0.03em' }}>Admin Dashboard</span>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                        onClick={handleSyncProducts}
                        disabled={syncBusy}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                        <RefreshCw size={13} strokeWidth={1.5} style={{ animation: syncBusy ? 'spin 1s linear infinite' : 'none' }} />
                        {syncBusy ? 'Syncing…' : 'Sync Products'}
                    </button>
                    <button
                        onClick={onLogout}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', padding: '0.35rem', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                        <LogOut size={14} strokeWidth={1.5} /> Logout
                    </button>
                </div>
            </div>

            {/* ── Sync log modal ── */}
            {showSyncLog && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#111', width: '90%', maxWidth: 700, padding: '1.5rem', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span style={{ color: '#d4d4d4', fontWeight: 600 }}>Product Sync Log</span>
                            <button onClick={() => setShowSyncLog(false)} style={{ background: 'none', border: 'none', color: '#d4d4d4', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                        </div>
                        <pre style={{ color: '#d4d4d4', fontSize: '0.75rem', maxHeight: '60vh', overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap' }}>
                            {syncLog.join('\n')}
                        </pre>
                    </div>
                </div>
            )}

            <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 1rem' }}>
                {/* ── Tabs ── */}
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '0.85rem 1.25rem',
                                background: 'none',
                                border: 'none',
                                borderBottom: activeTab === tab.id ? '2px solid var(--ink)' : '2px solid transparent',
                                color: activeTab === tab.id ? 'var(--ink)' : 'var(--ink-muted)',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: activeTab === tab.id ? 600 : 400,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                            }}
                        >
                            {tab.label}
                            {tab.count != null && tab.count > 0 && (
                                <span style={{ background: 'var(--bg-alt)', color: 'var(--ink-mid)', fontSize: '0.72rem', padding: '0.1rem 0.4rem', borderRadius: 10 }}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.5rem' }}>
                        <button onClick={() => refetch()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)' }} title="Refresh">
                            <RefreshCw size={14} strokeWidth={1.5} />
                        </button>
                    </div>
                </div>

                {/* ── Event Log Tab ── */}
                {activeTab === 'event_log' && <EventLogPanel />}

                {/* ── Orders Tabs ── */}
                {activeTab !== 'event_log' && (
                    <>
                        {/* ── Table header ── */}
                        {!isLoading && !isError && (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '110px 1fr 90px 140px 90px 100px 60px 130px',
                                padding: '0.5rem 1rem',
                                background: 'var(--bg-alt)',
                                borderBottom: '1px solid var(--border)',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                color: 'var(--ink-muted)',
                                gap: '0.5rem',
                            }}>
                                <span>Order</span>
                                <span>Customer</span>
                                <span>Date</span>
                                <span>Items</span>
                                <span>Total</span>
                                <span>Status</span>
                                <span>Odoo</span>
                                <span>Actions</span>
                            </div>
                        )}

                        {/* ── States ── */}
                        {isLoading && (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.85rem' }}>
                                Loading orders...
                            </div>
                        )}
                        {isError && (
                            <div style={{ padding: '3rem', textAlign: 'center', color: '#8c3a3a', fontSize: '0.85rem' }}>
                                Failed to load orders. <button className="btn btn-ghost" onClick={() => refetch()}>Retry</button>
                            </div>
                        )}
                        {!isLoading && !isError && displayOrders.length === 0 && (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.85rem' }}>
                                No orders in this view.
                            </div>
                        )}

                        {/* ── Order rows ── */}
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none' }}>
                            {displayOrders.map(order => (
                                <OrderRow key={order.id} order={order} onRefresh={handleRefresh} />
                            ))}
                        </div>
                    </>
                )}
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Admin() {
    const [authenticated, setAuthenticated] = useState(false)

    useEffect(() => {
        if (sessionStorage.getItem(SESSION_KEY)) {
            setAuthenticated(true)
        }
    }, [])

    function handleLogout() {
        sessionStorage.removeItem(SESSION_KEY)
        setAuthenticated(false)
    }

    if (!authenticated) {
        return <PinGate onAuth={() => setAuthenticated(true)} />
    }

    return <AdminDashboard onLogout={handleLogout} />
}
