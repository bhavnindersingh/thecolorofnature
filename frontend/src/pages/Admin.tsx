import { useState, useEffect, useCallback } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import {
    RefreshCw, LogOut, ChevronDown, ChevronUp,
    CheckCircle, XCircle, AlertTriangle, Truck, Clock, Package, Search
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

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_KEY = 'admin_pin'

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
    const { data, error, response } = await supabase.functions.invoke('admin', {
        body: { action, payload },
        headers: { Authorization: `Bearer ${pin}` },
    })
    if (error) {
        let msg = 'Request failed'
        if (response) {
            try {
                const body = await response.json()
                msg = body?.error ?? msg
            } catch {
                msg = (error as { message?: string }).message ?? msg
            }
        } else {
            msg = (error as { message?: string }).message ?? msg
        }
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
        <div className="admin-pin">
            <div className="admin-pin__card" style={{ width: 340 }}>
                <h1 className="admin-pin__title">Admin Access</h1>
                <p className="admin-pin__subtitle">The Colours of Nature</p>
                <form onSubmit={handleSubmit} className="admin-pin__form">
                    <input
                        type="password"
                        value={pin}
                        onChange={e => setPin(e.target.value)}
                        placeholder="Enter PIN"
                        className="admin-pin__input"
                        autoFocus
                    />
                    {error && <p className="admin-pin__error">{error}</p>}
                    <button type="submit" className="admin-pin__btn" disabled={loading || !pin}>
                        {loading ? 'Verifying…' : 'Enter'}
                    </button>
                </form>
            </div>
        </div>
    )
}

// ─── Order Row (simplified contextual actions) ──────────────────────────────

function OrderRow({ order, onRefresh }: { order: AdminOrder; onRefresh: () => void }) {
    const [expanded, setExpanded] = useState(false)
    const [carrier, setCarrier] = useState(order.carrier ?? '')
    const [trackingNum, setTrackingNum] = useState(order.tracking_number ?? '')
    const [estDelivery, setEstDelivery] = useState(order.estimated_delivery ?? '')
    const [returnNote, setReturnNote] = useState('')
    const [returnInstructions, setReturnInstructions] = useState('')
    const [showCancelConfirm, setShowCancelConfirm] = useState(false)
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

    const hasActiveReturn = order.return_requests.some(r => !['completed', 'rejected'].includes(r.status))
    const odooSynced = !!order.odoo_order_id
    const canPushToOdoo = !odooSynced && ['paid', 'processing'].includes(order.status)
    const canCancel = ['pending', 'paid', 'processing'].includes(order.status)

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

    async function handleShipOrder() {
        await run(async () => {
            await adminCall('update_tracking', {
                order_id: order.id,
                tracking_number: trackingNum,
                carrier,
                estimated_delivery: estDelivery || undefined,
            })
            showMsg('Order shipped — customer notified.', true)
        })
    }

    async function handlePushToOdoo() {
        await run(async () => {
            const res = await adminCall<{ success: boolean; odoo_order_id?: number; message?: string }>('push_to_odoo', { order_id: order.id })
            showMsg(res.message ?? `Synced to Odoo — ID ${res.odoo_order_id}`, true)
        })
    }

    async function handleCancel() {
        await run(async () => {
            await adminCall('cancel_order', { order_id: order.id })
            setShowCancelConfirm(false)
            showMsg('Order cancelled.', true)
        })
    }

    async function handleMarkDelivered() {
        await run(async () => {
            await adminCall('update_order_status', { order_id: order.id, status: 'delivered' })
            showMsg('Marked as delivered.', true)
        })
    }

    async function handleReturnAction(action: 'approve' | 'reject', returnId: string) {
        await run(async () => {
            await adminCall('handle_return', {
                return_request_id: returnId,
                action,
                admin_note: returnNote || undefined,
                return_instructions: action === 'approve' ? (returnInstructions || undefined) : undefined,
            })
            setReturnNote('')
            setReturnInstructions('')
            showMsg(`Return ${action}d.`, true)
        })
    }

    async function handleCompleteReturn(returnId: string) {
        await run(async () => {
            await adminCall('complete_return_simple', { return_request_id: returnId })
            showMsg('Return completed.', true)
        })
    }

    // ── Contextual action panel content ──
    function renderActionPanel() {
        const { status } = order

        // Cancelled — read-only
        if (status === 'cancelled') {
            return (
                <div className="admin-card">
                    <h4 className="admin-card__header">Cancelled</h4>
                    <p style={{ fontSize: '0.82rem', color: '#8494a7', margin: 0 }}>This order has been cancelled.</p>
                </div>
            )
        }

        // Pending — awaiting payment
        if (status === 'pending') {
            return (
                <div className="admin-card">
                    <h4 className="admin-card__header">Awaiting Payment</h4>
                    <p style={{ fontSize: '0.82rem', color: '#8494a7', margin: '0 0 0.75rem' }}>Customer has not confirmed payment yet.</p>
                    {renderCancelButton()}
                </div>
            )
        }

        // Paid/Processing without Odoo sync — retry sync
        if ((status === 'paid' || status === 'processing') && !odooSynced) {
            return (
                <div className="admin-card">
                    <h4 className="admin-card__header">Odoo Sync Required</h4>
                    <div style={{ background: '#fffbeb', border: '1px solid #f6e05e', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                        <AlertTriangle size={13} strokeWidth={1.5} color="#d69e2e" style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        This order has not been synced to Odoo. Push it to start fulfillment.
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button className="admin-action-btn admin-action-btn--warning admin-action-btn--sm" disabled={busy} onClick={handlePushToOdoo}>
                            {busy ? 'Syncing…' : 'Push to Odoo'}
                        </button>
                        {renderCancelButton()}
                    </div>
                </div>
            )
        }

        // Paid/Processing with Odoo sync — ship order
        if (status === 'paid' || status === 'processing') {
            return (
                <div className="admin-card">
                    <h4 className="admin-card__header">Ship Order</h4>
                    <div className="admin-tracking-form">
                        <div className="form-group">
                            <label className="form-label">Carrier</label>
                            <input value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="DTDC, Blue Dart…" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Tracking #</label>
                            <input value={trackingNum} onChange={e => setTrackingNum(e.target.value)} placeholder="AWB123456" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Est. Delivery</label>
                            <input type="date" value={estDelivery} onChange={e => setEstDelivery(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                                className="admin-action-btn admin-action-btn--primary admin-action-btn--sm"
                                disabled={busy || !carrier || !trackingNum}
                                onClick={handleShipOrder}
                            >
                                {busy ? 'Shipping…' : 'Ship Order'}
                            </button>
                            {renderCancelButton()}
                        </div>
                    </div>
                </div>
            )
        }

        // Shipped — mark delivered
        if (status === 'shipped') {
            return (
                <div className="admin-card">
                    <h4 className="admin-card__header">In Transit</h4>
                    {order.tracking_number && (
                        <div className="admin-tracking-info" style={{ marginBottom: '0.75rem' }}>
                            <strong>Tracking:</strong> {order.carrier} — {order.tracking_number}
                            {order.estimated_delivery && <><br /><strong>Est. delivery:</strong> {order.estimated_delivery}</>}
                        </div>
                    )}
                    <button className="admin-action-btn admin-action-btn--primary admin-action-btn--sm" disabled={busy} onClick={handleMarkDelivered}>
                        {busy ? 'Updating…' : 'Mark Delivered'}
                    </button>
                </div>
            )
        }

        // Delivered — show return actions if any, otherwise read-only
        if (status === 'delivered') {
            return (
                <div className="admin-card">
                    <h4 className="admin-card__header">Delivered</h4>
                    {order.return_requests.length === 0 ? (
                        <p style={{ fontSize: '0.82rem', color: '#8494a7', margin: 0 }}>Order delivered successfully. No return requests.</p>
                    ) : (
                        order.return_requests.map(r => renderReturnSection(r))
                    )}
                </div>
            )
        }

        return null
    }

    function renderCancelButton() {
        if (!canCancel) return null
        if (showCancelConfirm) {
            return (
                <>
                    <button className="admin-action-btn admin-action-btn--danger-solid admin-action-btn--sm" disabled={busy} onClick={handleCancel}>
                        {busy ? 'Cancelling…' : 'Yes, Cancel'}
                    </button>
                    <button className="admin-action-btn admin-action-btn--outline admin-action-btn--sm" onClick={() => setShowCancelConfirm(false)}>
                        No
                    </button>
                </>
            )
        }
        return (
            <button className="admin-action-btn admin-action-btn--danger admin-action-btn--sm" onClick={() => setShowCancelConfirm(true)}>
                Cancel Order
            </button>
        )
    }

    function renderReturnSection(r: AdminReturnRequest) {
        const statusLabel: Record<ReturnStatus, string> = {
            pending: 'Pending Review', approved: 'Approved — Awaiting Shipback',
            item_shipped: 'Customer Shipped', item_received: 'Item Received',
            rejected: 'Rejected', completed: 'Completed',
        }
        const isActive = !['completed', 'rejected'].includes(r.status)

        return (
            <div key={r.id} style={{ paddingBottom: '0.75rem', borderBottom: '1px solid #f0f4f8', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span className={`status-badge badge-${r.status === 'rejected' ? 'cancelled' : r.status === 'completed' ? 'delivered' : 'processing'}`} style={{ fontSize: '0.7rem' }}>
                        {statusLabel[r.status]}
                    </span>
                    <span style={{ color: '#8494a7', fontSize: '0.75rem' }}>{fmtDate(r.created_at)}</span>
                </div>

                <p style={{ fontSize: '0.82rem', margin: '0 0 0.25rem' }}><strong>Reason:</strong> {r.reason}</p>
                {r.admin_note && <p style={{ fontSize: '0.82rem', margin: '0 0 0.25rem' }}><strong>Note:</strong> {r.admin_note}</p>}
                {r.return_instructions && <p style={{ fontSize: '0.82rem', margin: '0 0 0.25rem' }}><strong>Instructions:</strong> {r.return_instructions}</p>}
                {r.odoo_return_id && <p style={{ fontSize: '0.78rem', color: '#8494a7', margin: '0 0 0.25rem' }}>Odoo return: #{r.odoo_return_id}</p>}

                {/* Pending: approve/reject */}
                {r.status === 'pending' && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.65rem', color: '#8494a7' }}>Return Instructions (emailed to customer)</label>
                            <textarea
                                style={{ width: '100%', fontSize: '0.82rem', padding: '0.4rem 0.5rem', border: '1px solid #c8d6e8', fontFamily: 'var(--font-sans)', resize: 'vertical', minHeight: 50 }}
                                value={returnInstructions}
                                onChange={e => setReturnInstructions(e.target.value)}
                                placeholder="Ship the item to…"
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.65rem', color: '#8494a7' }}>Admin Note (internal)</label>
                            <input
                                style={{ width: '100%', fontSize: '0.82rem', padding: '0.4rem 0.5rem', border: '1px solid #c8d6e8', fontFamily: 'var(--font-sans)' }}
                                value={returnNote}
                                onChange={e => setReturnNote(e.target.value)}
                                placeholder="Internal note…"
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="admin-action-btn admin-action-btn--primary admin-action-btn--sm" disabled={busy} onClick={() => handleReturnAction('approve', r.id)}>
                                {busy ? 'Processing…' : 'Approve & Email'}
                            </button>
                            <button className="admin-action-btn admin-action-btn--danger admin-action-btn--sm" disabled={busy} onClick={() => handleReturnAction('reject', r.id)}>
                                Reject
                            </button>
                        </div>
                    </div>
                )}

                {/* Any intermediate state: single Complete button */}
                {isActive && r.status !== 'pending' && (
                    <button className="admin-action-btn admin-action-btn--primary admin-action-btn--sm" style={{ marginTop: '0.5rem' }} disabled={busy} onClick={() => handleCompleteReturn(r.id)}>
                        {busy ? 'Processing…' : 'Complete Return'}
                    </button>
                )}
            </div>
        )
    }

    return (
        <div>
            {/* ── Collapsed Row ── */}
            <div
                className={`admin-order-row${expanded ? ' admin-order-row--expanded' : ''}`}
                onClick={() => setExpanded(v => !v)}
            >
                <span className="admin-order-row__id">{shortId(order.id)}</span>

                <div className="admin-order-row__customer">
                    <div className="admin-order-row__name">{customerName(order)}</div>
                    <div className="admin-order-row__email">{order.customer_email}</div>
                </div>

                <span className="admin-order-row__date">{fmtDate(order.created_at)}</span>

                <span className="admin-order-row__amount">{fmtAmount(order.total_amount)}</span>

                <span className={`status-badge badge-${order.status}`} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.73rem' }}>
                    {STATUS_ICONS[order.status]} {STATUS_LABELS[order.status]}
                </span>

                <span className="admin-odoo-badge" title={odooSynced ? `Odoo #${order.odoo_order_id}` : 'Not synced'}>
                    {odooSynced
                        ? <CheckCircle size={15} strokeWidth={1.5} color="#2a7a2a" />
                        : <AlertTriangle size={15} strokeWidth={1.5} color="#d69e2e" />}
                </span>

                <div className="admin-order-row__actions" onClick={e => e.stopPropagation()}>
                    {canPushToOdoo && (
                        <button className="admin-action-btn admin-action-btn--warning admin-action-btn--sm" disabled={busy} onClick={handlePushToOdoo}>
                            Sync Odoo
                        </button>
                    )}
                    {hasActiveReturn && (
                        <span style={{ fontSize: '0.7rem', background: '#fdf2f2', color: '#c53030', padding: '0.15rem 0.4rem', border: '1px solid #f5c6c6', borderRadius: 3 }}>
                            Return
                        </span>
                    )}
                    {expanded ? <ChevronUp size={14} strokeWidth={1.5} color="#8494a7" /> : <ChevronDown size={14} strokeWidth={1.5} color="#8494a7" />}
                </div>
            </div>

            {/* ── Expanded Detail — 2-column layout ── */}
            {expanded && (
                <div className="admin-expanded">
                    {msg && (
                        <div className={`admin-msg ${msg.ok ? 'admin-msg--success' : 'admin-msg--error'}`}>
                            {msg.text}
                        </div>
                    )}

                    <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        {/* ── Left: Order Info ── */}
                        <div className="admin-card">
                            <h4 className="admin-card__header">Items ({order.order_items.length})</h4>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th style={{ textAlign: 'right' }}>Qty</th>
                                        <th style={{ textAlign: 'right' }}>Price</th>
                                        <th style={{ textAlign: 'right' }}>Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.order_items.map(item => (
                                        <tr key={item.id}>
                                            <td>{item.product?.name ?? '—'}</td>
                                            <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                                            <td style={{ textAlign: 'right' }}>{fmtAmount(item.unit_price)}</td>
                                            <td style={{ textAlign: 'right' }}>{fmtAmount(item.quantity * item.unit_price)}</td>
                                        </tr>
                                    ))}
                                    <tr className="total-row">
                                        <td colSpan={3} style={{ textAlign: 'right' }}>Total</td>
                                        <td style={{ textAlign: 'right' }}>{fmtAmount(order.total_amount)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Shipping address */}
                            <h4 className="admin-card__header" style={{ marginTop: '1rem' }}>Shipping</h4>
                            {order.shipping_address ? (
                                <address className="admin-address">
                                    {[
                                        [order.shipping_address.first_name, order.shipping_address.last_name].filter(Boolean).join(' '),
                                        order.shipping_address.address_line_1,
                                        order.shipping_address.address_line_2,
                                        [order.shipping_address.city, order.shipping_address.state, order.shipping_address.postal_code].filter(Boolean).join(', '),
                                        order.shipping_address.country,
                                        order.shipping_address.phone,
                                    ].filter(Boolean).map((line, i) => <span key={i}>{line}<br /></span>)}
                                </address>
                            ) : <p className="admin-address">No address provided</p>}

                            {order.odoo_order_id && (
                                <div className="admin-odoo-info">
                                    Odoo SO: <strong>#{order.odoo_order_id}</strong>
                                    {order.odoo_picking_name && <> · Picking: <strong>{order.odoo_picking_name}</strong></>}
                                </div>
                            )}
                        </div>

                        {/* ── Right: Contextual Action ── */}
                        {renderActionPanel()}
                    </div>
                </div>
            )}
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
        'order': '#2c5aa0',
        'return': '#7c3aed',
        'webhook': '#18336B',
        'product_sync': '#d69e2e',
    }

    function eventColor(entityType: string) {
        return EVENT_TYPE_COLORS[entityType] ?? '#4a5568'
    }

    return (
        <div style={{ padding: '1.25rem 0' }}>
            <div className="admin-events__filters">
                <div className="admin-events__search">
                    <Search size={14} color="#8494a7" />
                    <input
                        className="admin-events__input"
                        placeholder="Search by entity ID..."
                        value={searchId}
                        onChange={e => setSearchId(e.target.value)}
                    />
                </div>
                <select
                    className="admin-events__select"
                    value={entityFilter}
                    onChange={e => setEntityFilter(e.target.value)}
                >
                    <option value="">All Types</option>
                    <option value="order">Orders</option>
                    <option value="return">Returns</option>
                    <option value="product_sync">Product Sync</option>
                </select>
                <button className="admin-tab__refresh" onClick={() => refetch()} title="Refresh">
                    <RefreshCw size={14} strokeWidth={1.5} />
                </button>
            </div>

            {isLoading && <div className="admin-state">Loading events...</div>}
            {!isLoading && events.length === 0 && <div className="admin-state">No events found.</div>}

            {!isLoading && events.length > 0 && (
                <div className="admin-card" style={{ padding: 0 }}>
                    {events.map(event => (
                        <div key={event.id} className="admin-events__row">
                            <span className="admin-events__time">
                                {new Date(event.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span
                                className="admin-events__badge"
                                style={{
                                    border: `1px solid ${eventColor(event.entity_type)}40`,
                                    color: eventColor(event.entity_type),
                                    background: `${eventColor(event.entity_type)}10`,
                                }}
                            >
                                {event.event_type}
                            </span>
                            {event.entity_id && (
                                <span className="admin-events__entity">{event.entity_id.slice(0, 8)}</span>
                            )}
                            <span className="admin-events__details">
                                {Object.entries(event.details)
                                    .filter(([, v]) => v != null && v !== '')
                                    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                                    .join(' | ') || '—'}
                            </span>
                            <span className="admin-events__actor">{event.actor}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
    const [activeTab, setActiveTab] = useState<Tab>('all')
    const [syncBusy, setSyncBusy] = useState(false)
    const [syncLog, setSyncLog] = useState<string[]>([])
    const [showSyncLog, setShowSyncLog] = useState(false)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const queryClient = useQueryClient()

    useEffect(() => {
        setSearch('')
        setStatusFilter('all')
        setDateFrom('')
        setDateTo('')
    }, [activeTab])

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

    const baseOrders = activeTab === 'pending_returns'
        ? orders.filter(o => o.return_requests.some(r => !['completed', 'rejected'].includes(r.status)))
        : orders

    const displayOrders = baseOrders.filter(o => {
        if (statusFilter !== 'all' && o.status !== statusFilter) return false
        if (dateFrom && o.created_at < dateFrom) return false
        if (dateTo && o.created_at > new Date(dateTo + 'T23:59:59').toISOString()) return false
        if (search) {
            const q = search.toLowerCase()
            const name = (o.profile?.full_name ?? `${o.profile?.first_name ?? ''} ${o.profile?.last_name ?? ''}`).toLowerCase()
            if (!o.id.toLowerCase().includes(q) &&
                !(o.customer_email ?? '').toLowerCase().includes(q) &&
                !name.includes(q)) return false
        }
        return true
    })

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
        <div className="admin">
            {/* ── Sync log modal ── */}
            {showSyncLog && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal">
                        <div className="admin-modal__header">
                            <span className="admin-modal__title">Product Sync Log</span>
                            <button className="admin-modal__close" onClick={() => setShowSyncLog(false)}>×</button>
                        </div>
                        <pre className="admin-modal__pre">{syncLog.join('\n')}</pre>
                    </div>
                </div>
            )}

            <div className="admin-container">
                {/* ── Header (inside container) ── */}
                <div className="admin-header">
                    <span className="admin-header__title">Admin Dashboard</span>
                    <div className="admin-header__actions">
                        <button className="admin-header__btn" onClick={handleSyncProducts} disabled={syncBusy}>
                            <RefreshCw size={13} strokeWidth={1.5} style={{ animation: syncBusy ? 'admin-spin 1s linear infinite' : 'none' }} />
                            {syncBusy ? 'Syncing…' : 'Sync Products'}
                        </button>
                        <button className="admin-header__btn admin-header__btn--ghost" onClick={onLogout}>
                            <LogOut size={14} strokeWidth={1.5} /> Logout
                        </button>
                    </div>
                </div>

                {/* ── Tabs ── */}
                <div className="admin-tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`admin-tab${activeTab === tab.id ? ' admin-tab--active' : ''}`}
                        >
                            {tab.label}
                            {tab.count != null && tab.count > 0 && (
                                <span className="admin-tab__count">{tab.count}</span>
                            )}
                        </button>
                    ))}
                    <button className="admin-tab__refresh" onClick={() => refetch()} title="Refresh">
                        <RefreshCw size={14} strokeWidth={1.5} />
                    </button>
                </div>

                {/* ── Event Log Tab ── */}
                {activeTab === 'event_log' && <EventLogPanel />}

                {/* ── Orders Tabs ── */}
                {activeTab !== 'event_log' && (
                    <>
                        {/* ── Filter bar ── */}
                        <div className="admin-filter-bar">
                            <div className="admin-filter-bar__search">
                                <Search size={14} strokeWidth={1.5} className="admin-filter-bar__search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search email, name, order ID…"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="admin-filter-bar__input"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value as OrderStatus | 'all')}
                                className="admin-filter-bar__select"
                            >
                                <option value="all">All Statuses</option>
                                {(['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'] as const).map(s => (
                                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                ))}
                            </select>
                            <div className="admin-filter-bar__dates">
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={e => setDateFrom(e.target.value)}
                                    className="admin-filter-bar__select"
                                    title="From date"
                                />
                                <span className="admin-filter-bar__date-sep">—</span>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={e => setDateTo(e.target.value)}
                                    className="admin-filter-bar__select"
                                    title="To date"
                                />
                            </div>
                            {(search || statusFilter !== 'all' || dateFrom || dateTo) && (
                                <button
                                    className="admin-filter-bar__clear"
                                    onClick={() => { setSearch(''); setStatusFilter('all'); setDateFrom(''); setDateTo('') }}
                                >
                                    Clear filters
                                </button>
                            )}
                            <span className="admin-filter-bar__count">
                                {displayOrders.length} of {baseOrders.length} orders
                            </span>
                        </div>

                        {!isLoading && !isError && (
                            <div className="admin-table-header">
                                <span>Order</span>
                                <span>Customer</span>
                                <span>Date</span>
                                <span>Total</span>
                                <span>Status</span>
                                <span>Odoo</span>
                                <span>Actions</span>
                            </div>
                        )}

                        {isLoading && <div className="admin-state">Loading orders...</div>}
                        {isError && (
                            <div className="admin-state" style={{ color: '#c53030' }}>
                                Failed to load orders. <button className="admin-action-btn admin-action-btn--outline admin-action-btn--sm" onClick={() => refetch()}>Retry</button>
                            </div>
                        )}
                        {!isLoading && !isError && displayOrders.length === 0 && (
                            <div className="admin-state">No orders in this view.</div>
                        )}

                        <div className="admin-order-list">
                            {displayOrders.map(order => (
                                <OrderRow key={order.id} order={order} onRefresh={handleRefresh} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Admin() {
    const [authenticated, setAuthenticated] = useState(() => !!sessionStorage.getItem(SESSION_KEY))

    function handleLogout() {
        sessionStorage.removeItem(SESSION_KEY)
        setAuthenticated(false)
    }

    if (!authenticated) {
        return <PinGate onAuth={() => setAuthenticated(true)} />
    }

    return <AdminDashboard onLogout={handleLogout} />
}
