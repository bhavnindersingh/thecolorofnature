import { useState, useEffect } from 'react'
import { supabase, getMyOrders, getMyReturns, createReturnRequest, getMyProfile, updateMyProfile, getMyAddresses, addAddress, deleteAddress } from '../lib/supabase'
import type { Order, ReturnRequest, Profile, Address } from '../lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut, Package, RotateCcw, MapPin, User, ChevronDown, ChevronUp, Clock, Truck, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

type Tab = 'orders' | 'returns' | 'addresses' | 'profile'

// ─── Status badge helper ──────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'badge-pending' },
    paid: { label: 'Paid', className: 'badge-paid' },
    processing: { label: 'Processing', className: 'badge-processing' },
    shipped: { label: 'Shipped', className: 'badge-shipped' },
    delivered: { label: 'Delivered', className: 'badge-delivered' },
    cancelled: { label: 'Cancelled', className: 'badge-cancelled' },
    approved: { label: 'Approved', className: 'badge-paid' },
    rejected: { label: 'Rejected', className: 'badge-cancelled' },
    completed: { label: 'Completed', className: 'badge-delivered' },
}

function StatusBadge({ status }: { status: string }) {
    const meta = STATUS_META[status] || { label: status, className: '' }
    return <span className={`status-badge ${meta.className}`}>{meta.label}</span>
}

const STATUS_ICON: Record<string, React.ReactNode> = {
    pending: <Clock size={14} />,
    paid: <CheckCircle size={14} />,
    processing: <Package size={14} />,
    shipped: <Truck size={14} />,
    delivered: <CheckCircle size={14} />,
    cancelled: <XCircle size={14} />,
}

// ─── Orders Tab ───────────────────────────────────────────────────────────────
function OrdersTab() {
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
    const [returnOrderId, setReturnOrderId] = useState<string | null>(null)
    const [returnReason, setReturnReason] = useState('')
    const queryClient = useQueryClient()

    const { data: orders, isLoading } = useQuery({
        queryKey: ['my-orders'],
        queryFn: async () => {
            const { data, error } = await getMyOrders()
            if (error) throw error
            return data as Order[]
        },
    })

    const returnMutation = useMutation({
        mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
            createReturnRequest(orderId, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-orders'] })
            queryClient.invalidateQueries({ queryKey: ['my-returns'] })
            setReturnOrderId(null)
            setReturnReason('')
        },
    })

    if (isLoading) return <div className="account-loading">Loading your orders…</div>

    if (!orders?.length) {
        return (
            <div className="account-empty">
                <Package size={40} strokeWidth={1} />
                <p>No orders yet</p>
                <span>When you place an order, it will appear here.</span>
            </div>
        )
    }

    return (
        <div className="orders-list">
            {orders.map((order) => (
                <div className="order-card" key={order.id}>
                    <div
                        className="order-card-header"
                        onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                    >
                        <div className="order-card-meta">
                            <span className="order-number">#{order.id.slice(0, 8).toUpperCase()}</span>
                            <span className="order-date">
                                {new Date(order.created_at).toLocaleDateString('en-IN', {
                                    day: 'numeric', month: 'short', year: 'numeric'
                                })}
                            </span>
                        </div>
                        <div className="order-card-status">
                            <StatusBadge status={order.status} />
                            <span className="order-total">₹{order.total_amount.toFixed(2)}</span>
                            {expandedOrder === order.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                    </div>

                    {expandedOrder === order.id && (
                        <div className="order-card-detail">
                            {/* Items */}
                            <div className="order-detail-section">
                                <div className="order-detail-label">Items</div>
                                {order.order_items?.map((item) => {
                                    const img = item.product?.product_images?.find(i => i.is_primary)?.image_url
                                        ?? item.product?.product_images?.[0]?.image_url
                                        ?? item.product?.image_url
                                    return (
                                        <div className="order-item-row" key={item.id}>
                                            <div className="order-item-thumb">
                                                {img ? <img src={img} alt={item.product?.name} /> : <span>🌿</span>}
                                            </div>
                                            <div className="order-item-info">
                                                <div className="order-item-name">{item.product?.name || `Product #${item.product_id}`}</div>
                                                <div className="order-item-meta">Qty: {item.quantity} × ₹{item.unit_price.toFixed(2)}</div>
                                            </div>
                                            <div className="order-item-subtotal">₹{(item.quantity * item.unit_price).toFixed(2)}</div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Tracking */}
                            {order.tracking_number && (
                                <div className="order-detail-section">
                                    <div className="order-detail-label">Tracking</div>
                                    <div className="order-tracking">
                                        <Truck size={14} />
                                        <span>{order.carrier || 'Carrier'}: {order.tracking_number}</span>
                                        {order.estimated_delivery && (
                                            <span className="order-eta">ETA: {new Date(order.estimated_delivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Status Timeline */}
                            {order.order_status_history && order.order_status_history.length > 0 && (
                                <div className="order-detail-section">
                                    <div className="order-detail-label">Timeline</div>
                                    <div className="order-timeline">
                                        {order.order_status_history
                                            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                                            .map((entry) => (
                                                <div className="timeline-entry" key={entry.id}>
                                                    <div className="timeline-icon">{STATUS_ICON[entry.status] || <Clock size={14} />}</div>
                                                    <div className="timeline-content">
                                                        <span className="timeline-note">{entry.note || entry.status}</span>
                                                        <span className="timeline-time">
                                                            {new Date(entry.created_at).toLocaleDateString('en-IN', {
                                                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* Return button */}
                            {(order.status === 'delivered' || order.status === 'shipped') && !order.return_requests?.length && (
                                <div className="order-detail-section">
                                    {returnOrderId === order.id ? (
                                        <div className="return-form">
                                            <div className="order-detail-label">Reason for Return</div>
                                            <textarea
                                                className="form-input"
                                                placeholder="Please describe why you'd like to return this order…"
                                                value={returnReason}
                                                onChange={(e) => setReturnReason(e.target.value)}
                                                rows={3}
                                            />
                                            <div className="return-form-actions">
                                                <button className="btn btn-primary btn-sm" disabled={!returnReason.trim() || returnMutation.isPending}
                                                    onClick={() => returnMutation.mutate({ orderId: order.id, reason: returnReason })}>
                                                    {returnMutation.isPending ? 'Submitting…' : 'Submit Return'}
                                                </button>
                                                <button className="btn btn-ghost btn-sm" onClick={() => { setReturnOrderId(null); setReturnReason('') }}>Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button className="btn btn-outline btn-sm" onClick={() => setReturnOrderId(order.id)}>
                                            <RotateCcw size={12} /> Request Return
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Existing return */}
                            {order.return_requests && order.return_requests.length > 0 && (
                                <div className="order-detail-section">
                                    <div className="order-detail-label">Return Request</div>
                                    {order.return_requests.map((ret) => (
                                        <div className="return-info" key={ret.id}>
                                            <StatusBadge status={ret.status} />
                                            <span className="return-reason">{ret.reason}</span>
                                            {ret.admin_note && <span className="return-admin-note">Note: {ret.admin_note}</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}


// ─── Returns Tab ──────────────────────────────────────────────────────────────
function ReturnsTab() {
    const { data: returns, isLoading } = useQuery({
        queryKey: ['my-returns'],
        queryFn: async () => {
            const { data, error } = await getMyReturns()
            if (error) throw error
            return data as ReturnRequest[]
        },
    })

    if (isLoading) return <div className="account-loading">Loading…</div>

    if (!returns?.length) {
        return (
            <div className="account-empty">
                <RotateCcw size={40} strokeWidth={1} />
                <p>No return requests</p>
                <span>You can request a return from the Orders tab after delivery.</span>
            </div>
        )
    }

    return (
        <div className="returns-list">
            {returns.map((ret) => (
                <div className="return-card" key={ret.id}>
                    <div className="return-card-header">
                        <span className="order-number">Order #{ret.order_id.slice(0, 8).toUpperCase()}</span>
                        <StatusBadge status={ret.status} />
                    </div>
                    <div className="return-card-body">
                        <div className="return-reason">{ret.reason}</div>
                        {ret.admin_note && <div className="return-admin-note"><AlertCircle size={12} /> {ret.admin_note}</div>}
                        <div className="return-date">
                            Requested {new Date(ret.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}


// ─── Addresses Tab ────────────────────────────────────────────────────────────
function AddressesTab() {
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ label: 'Home', first_name: '', last_name: '', address_line_1: '', address_line_2: '', city: '', state: '', postal_code: '', country: 'India', phone: '', is_default: false })
    const queryClient = useQueryClient()

    const { data: addresses, isLoading } = useQuery({
        queryKey: ['my-addresses'],
        queryFn: async () => {
            const { data, error } = await getMyAddresses()
            if (error) throw error
            return data as Address[]
        },
    })

    const addMutation = useMutation({
        mutationFn: (addr: typeof form) => addAddress(addr),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-addresses'] })
            setShowForm(false)
            setForm({ label: 'Home', first_name: '', last_name: '', address_line_1: '', address_line_2: '', city: '', state: '', postal_code: '', country: 'India', phone: '', is_default: false })
        },
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => { await deleteAddress(id) },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-addresses'] }),
    })

    if (isLoading) return <div className="account-loading">Loading…</div>

    return (
        <div>
            {(!addresses?.length && !showForm) && (
                <div className="account-empty">
                    <MapPin size={40} strokeWidth={1} />
                    <p>No saved addresses</p>
                    <span>Add a shipping address for faster checkout.</span>
                </div>
            )}

            {addresses && addresses.length > 0 && (
                <div className="address-grid">
                    {addresses.map((addr) => (
                        <div className={`address-card${addr.is_default ? ' address-default' : ''}`} key={addr.id}>
                            {addr.is_default && <span className="address-default-badge">Default</span>}
                            <div className="address-label">{addr.label || 'Address'}</div>
                            <div className="address-text">
                                {addr.first_name} {addr.last_name}<br />
                                {addr.address_line_1}<br />
                                {addr.address_line_2 && <>{addr.address_line_2}<br /></>}
                                {addr.city}, {addr.state} {addr.postal_code}<br />
                                {addr.country}
                            </div>
                            {addr.phone && <div className="address-phone">{addr.phone}</div>}
                            <button className="btn btn-ghost btn-sm" onClick={() => deleteMutation.mutate(addr.id)}
                                style={{ marginTop: '0.75rem' }}>Remove</button>
                        </div>
                    ))}
                </div>
            )}

            {showForm ? (
                <div className="address-form" style={{ marginTop: '1.5rem' }}>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Label</label>
                            <select className="form-input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}>
                                <option>Home</option><option>Work</option><option>Other</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">First Name</label>
                            <input className="form-input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Last Name</label>
                            <input className="form-input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Address Line 1</label>
                        <input className="form-input" value={form.address_line_1} onChange={(e) => setForm({ ...form, address_line_1: e.target.value })} placeholder="123 Main Street" required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Address Line 2</label>
                        <input className="form-input" value={form.address_line_2} onChange={(e) => setForm({ ...form, address_line_2: e.target.value })} placeholder="Apt, Suite, etc." />
                    </div>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">City</label>
                            <input className="form-input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">State</label>
                            <input className="form-input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Postal Code</label>
                            <input className="form-input" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} required />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Phone</label>
                        <input className="form-input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91..." />
                    </div>
                    <div className="return-form-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => addMutation.mutate(form)} disabled={!form.address_line_1 || !form.city || !form.first_name || addMutation.isPending}>
                            {addMutation.isPending ? 'Saving…' : 'Save Address'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
                    </div>
                </div>
            ) : (
                <button className="btn btn-outline btn-sm" onClick={() => setShowForm(true)} style={{ marginTop: '1.5rem' }}>
                    <MapPin size={12} /> Add New Address
                </button>
            )}
        </div>
    )
}


// ─── Profile Tab ──────────────────────────────────────────────────────────────
function ProfileTab() {
    const [editing, setEditing] = useState(false)
    const [formData, setFormData] = useState({ first_name: '', last_name: '', phone: '' })
    const queryClient = useQueryClient()

    const { data: profile, isLoading } = useQuery({
        queryKey: ['my-profile'],
        queryFn: async () => {
            const { data, error } = await getMyProfile()
            if (error) throw error
            return data as Profile
        },
    })

    useEffect(() => {
        if (profile) {
            setFormData({
                first_name: profile.first_name || '',
                last_name: profile.last_name || '',
                phone: profile.phone || '',
            })
        }
    }, [profile])

    const updateMutation = useMutation({
        mutationFn: (data: typeof formData) => updateMyProfile(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-profile'] })
            setEditing(false)
        },
    })

    if (isLoading) return <div className="account-loading">Loading…</div>

    return (
        <div className="profile-section">
            <div className="profile-avatar">
                <User size={40} strokeWidth={1} />
            </div>
            <div className="profile-email">{profile?.full_name || profile?.first_name || 'Customer'}</div>

            {editing ? (
                <div className="profile-form">
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">First Name</label>
                            <input className="form-input" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Last Name</label>
                            <input className="form-input" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Phone</label>
                        <input className="form-input" type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+91..." />
                    </div>
                    <div className="return-form-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => updateMutation.mutate(formData)} disabled={updateMutation.isPending}>
                            {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                    </div>
                </div>
            ) : (
                <div className="profile-details">
                    <div className="profile-row"><span>Email</span><span>{profile?.full_name ? profile.full_name.split(' ')[0] + '...' : ''} (via auth)</span></div>
                    <div className="profile-row"><span>Name</span><span>{profile?.first_name} {profile?.last_name}</span></div>
                    <div className="profile-row"><span>Phone</span><span>{profile?.phone || '—'}</span></div>
                    <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)} style={{ marginTop: '1.5rem' }}>
                        <User size={12} /> Edit Profile
                    </button>
                </div>
            )}
        </div>
    )
}


// ─── MAIN Account Component ──────────────────────────────────────────────────
export default function Account() {
    const [mode, setMode] = useState<'login' | 'signup'>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
    const [activeTab, setActiveTab] = useState<Tab>('orders')

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

    const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: 'orders', label: 'Orders', icon: <Package size={16} strokeWidth={1.5} /> },
        { key: 'returns', label: 'Returns', icon: <RotateCcw size={16} strokeWidth={1.5} /> },
        { key: 'addresses', label: 'Addresses', icon: <MapPin size={16} strokeWidth={1.5} /> },
        { key: 'profile', label: 'Profile', icon: <User size={16} strokeWidth={1.5} /> },
    ]

    /* ── Signed in: Dashboard ───────────────────────────────────── */
    if (user) {
        return (
            <main className="account-page">
                <div className="container">
                    <div className="account-header">
                        <div>
                            <h1 className="account-title">My Account</h1>
                            <div className="account-email">{user.email}</div>
                        </div>
                        <button onClick={handleLogout} className="btn btn-ghost">
                            <LogOut size={14} strokeWidth={1.5} /> Sign Out
                        </button>
                    </div>

                    <div className="account-tabs">
                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                className={`account-tab${activeTab === tab.key ? ' active' : ''}`}
                                onClick={() => setActiveTab(tab.key)}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="account-content">
                        {activeTab === 'orders' && <OrdersTab />}
                        {activeTab === 'returns' && <ReturnsTab />}
                        {activeTab === 'addresses' && <AddressesTab />}
                        {activeTab === 'profile' && <ProfileTab />}
                    </div>
                </div>
            </main>
        )
    }

    /* ── Auth form ──────────────────────────────────────────────── */
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
