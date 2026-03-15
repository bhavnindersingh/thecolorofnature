import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import {
    supabase,
    getMyOrders, getMyReturns, createReturnRequest,
    getMyProfile, updateMyProfile,
    getMyAddresses, addAddress, deleteAddress, setDefaultAddress,
} from '../lib/supabase'
import type { Order, ReturnRequest, Profile, Address } from '../lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import {
    LogOut, Package, RotateCcw, MapPin, User as UserIcon,
    ChevronDown, ChevronUp, Clock, Truck, CheckCircle, XCircle, AlertCircle, Star,
    Eye, EyeOff,
} from 'lucide-react'

type Tab = 'orders' | 'returns' | 'addresses' | 'profile'

const STALE_5MIN = 5 * 60 * 1000

// ─── Error mapping ────────────────────────────────────────────────────────────
function mapAuthError(msg: string): string {
    if (msg.includes('Invalid login credentials')) return 'Incorrect email or password.'
    if (msg.includes('User already registered')) return 'An account with this email exists. Try signing in.'
    if (msg.includes('Email not confirmed')) return 'Please confirm your email before signing in.'
    if (msg.includes('Password should be at least')) return 'Password must be at least 6 characters.'
    return msg
}

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; className: string }> = {
    pending:    { label: 'Pending',    className: 'badge-pending' },
    paid:       { label: 'Paid',       className: 'badge-paid' },
    processing: { label: 'Processing', className: 'badge-processing' },
    shipped:    { label: 'Shipped',    className: 'badge-shipped' },
    delivered:  { label: 'Delivered',  className: 'badge-delivered' },
    cancelled:  { label: 'Cancelled',  className: 'badge-cancelled' },
    approved:   { label: 'Approved',   className: 'badge-paid' },
    rejected:   { label: 'Rejected',   className: 'badge-cancelled' },
    completed:  { label: 'Completed',  className: 'badge-delivered' },
}

const STATUS_ICON: Record<string, React.ReactNode> = {
    pending:    <Clock size={14} />,
    paid:       <CheckCircle size={14} />,
    processing: <Package size={14} />,
    shipped:    <Truck size={14} />,
    delivered:  <CheckCircle size={14} />,
    cancelled:  <XCircle size={14} />,
}

function StatusBadge({ status }: { status: string }) {
    const meta = STATUS_META[status] ?? { label: status, className: '' }
    return <span className={`status-badge ${meta.className}`}>{meta.label}</span>
}

function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
    return new Date(iso).toLocaleDateString('en-IN', opts ?? { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Orders Tab ───────────────────────────────────────────────────────────────
function OrdersTab() {
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
    const [returnOrderId, setReturnOrderId] = useState<string | null>(null)
    const [returnReason, setReturnReason] = useState('')
    const queryClient = useQueryClient()

    const { data: orders, isLoading, error } = useQuery({
        queryKey: ['my-orders'],
        queryFn: async () => {
            const { data, error } = await getMyOrders()
            if (error) throw error
            return data as Order[]
        },
        staleTime: STALE_5MIN,
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
    if (error) return <div className="account-empty"><AlertCircle size={32} strokeWidth={1} /><p>Could not load orders</p><span>{(error as Error).message}</span></div>

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
                            <span className="order-date">{fmtDate(order.created_at)}</span>
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
                                    const img =
                                        item.product?.product_images?.find(i => i.is_primary)?.image_url
                                        ?? item.product?.product_images?.[0]?.image_url
                                        ?? item.product?.image_url
                                    return (
                                        <div className="order-item-row" key={item.id}>
                                            <div className="order-item-thumb">
                                                {img ? <img src={img} alt={item.product?.name} /> : <span>🌿</span>}
                                            </div>
                                            <div className="order-item-info">
                                                <div className="order-item-name">{item.product?.name ?? `Product #${item.product_id}`}</div>
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
                                        <span>{order.carrier ?? 'Carrier'}: {order.tracking_number}</span>
                                        {order.estimated_delivery && (
                                            <span className="order-eta">ETA: {fmtDate(order.estimated_delivery, { day: 'numeric', month: 'short' })}</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Status Timeline */}
                            {!!order.order_status_history?.length && (
                                <div className="order-detail-section">
                                    <div className="order-detail-label">Timeline</div>
                                    <div className="order-timeline">
                                        {[...order.order_status_history]
                                            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                                            .map((entry) => (
                                                <div className="timeline-entry" key={entry.id}>
                                                    <div className="timeline-icon">{STATUS_ICON[entry.status] ?? <Clock size={14} />}</div>
                                                    <div className="timeline-content">
                                                        <span className="timeline-note">{entry.note ?? entry.status}</span>
                                                        <span className="timeline-time">
                                                            {fmtDate(entry.created_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* Return */}
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
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    disabled={!returnReason.trim() || returnMutation.isPending}
                                                    onClick={() => returnMutation.mutate({ orderId: order.id, reason: returnReason })}
                                                >
                                                    {returnMutation.isPending ? 'Submitting…' : 'Submit Return'}
                                                </button>
                                                <button className="btn btn-ghost btn-sm" onClick={() => { setReturnOrderId(null); setReturnReason('') }}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button className="btn btn-outline btn-sm" onClick={() => setReturnOrderId(order.id)}>
                                            <RotateCcw size={12} /> Request Return
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Existing return status */}
                            {!!order.return_requests?.length && (
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
    const { data: returns, isLoading, error } = useQuery({
        queryKey: ['my-returns'],
        queryFn: async () => {
            const { data, error } = await getMyReturns()
            if (error) throw error
            return data as ReturnRequest[]
        },
        staleTime: STALE_5MIN,
    })

    if (isLoading) return <div className="account-loading">Loading…</div>
    if (error) return <div className="account-empty"><AlertCircle size={32} strokeWidth={1} /><p>Could not load returns</p></div>

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
                        {ret.admin_note && (
                            <div className="return-admin-note"><AlertCircle size={12} /> {ret.admin_note}</div>
                        )}
                        <div className="return-date">
                            Requested {fmtDate(ret.created_at)}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}


// ─── Addresses Tab ────────────────────────────────────────────────────────────
const BLANK_ADDR = {
    label: 'Home', first_name: '', last_name: '',
    address_line_1: '', address_line_2: '', city: '',
    state: '', postal_code: '', country: 'India', phone: '', is_default: false,
}

function AddressesTab() {
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState(BLANK_ADDR)
    const queryClient = useQueryClient()

    const { data: addresses, isLoading, error } = useQuery({
        queryKey: ['my-addresses'],
        queryFn: async () => {
            const { data, error } = await getMyAddresses()
            if (error) throw error
            return data as Address[]
        },
        staleTime: STALE_5MIN,
    })

    const addMutation = useMutation({
        mutationFn: (addr: typeof form) => addAddress(addr),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-addresses'] })
            setShowForm(false)
            setForm(BLANK_ADDR)
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteAddress(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-addresses'] }),
    })

    const defaultMutation = useMutation({
        mutationFn: (id: string) => setDefaultAddress(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-addresses'] }),
    })

    if (isLoading) return <div className="account-loading">Loading…</div>
    if (error) return <div className="account-empty"><AlertCircle size={32} strokeWidth={1} /><p>Could not load addresses</p></div>

    const canSubmit = form.address_line_1.trim() && form.city.trim() && form.first_name.trim() && form.postal_code.trim()

    return (
        <div>
            {!addresses?.length && !showForm && (
                <div className="account-empty">
                    <MapPin size={40} strokeWidth={1} />
                    <p>No saved addresses</p>
                    <span>Add a shipping address for faster checkout.</span>
                </div>
            )}

            {!!addresses?.length && (
                <div className="address-grid">
                    {addresses.map((addr) => (
                        <div className={`address-card${addr.is_default ? ' address-default' : ''}`} key={addr.id}>
                            {addr.is_default && <span className="address-default-badge"><Star size={10} /> Default</span>}
                            <div className="address-label">{addr.label ?? 'Address'}</div>
                            <div className="address-text">
                                {addr.first_name} {addr.last_name}<br />
                                {addr.address_line_1}<br />
                                {addr.address_line_2 && <>{addr.address_line_2}<br /></>}
                                {addr.city}, {addr.state} {addr.postal_code}<br />
                                {addr.country}
                            </div>
                            {addr.phone && <div className="address-phone">{addr.phone}</div>}
                            <div className="address-actions">
                                {!addr.is_default && (
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        disabled={defaultMutation.isPending}
                                        onClick={() => defaultMutation.mutate(addr.id)}
                                    >
                                        Set Default
                                    </button>
                                )}
                                <button
                                    className="btn btn-ghost btn-sm"
                                    disabled={deleteMutation.isPending}
                                    onClick={() => deleteMutation.mutate(addr.id)}
                                >
                                    Remove
                                </button>
                            </div>
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
                            <label className="form-label">First Name *</label>
                            <input className="form-input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Last Name</label>
                            <input className="form-input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Address Line 1 *</label>
                        <input className="form-input" value={form.address_line_1} onChange={(e) => setForm({ ...form, address_line_1: e.target.value })} placeholder="123 Main Street" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Address Line 2</label>
                        <input className="form-input" value={form.address_line_2} onChange={(e) => setForm({ ...form, address_line_2: e.target.value })} placeholder="Apt, Suite, etc." />
                    </div>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">City *</label>
                            <input className="form-input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">State</label>
                            <input className="form-input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Postal Code *</label>
                            <input className="form-input" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Phone</label>
                        <input className="form-input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91..." />
                    </div>
                    <div className="return-form-actions">
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => addMutation.mutate(form)}
                            disabled={!canSubmit || addMutation.isPending}
                        >
                            {addMutation.isPending ? 'Saving…' : 'Save Address'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setForm(BLANK_ADDR) }}>Cancel</button>
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
function ProfileTab({ user }: { user: User }) {
    const [editing, setEditing] = useState(false)
    const [formData, setFormData] = useState({ first_name: '', last_name: '', phone: '' })
    const queryClient = useQueryClient()

    const { data: profile, isLoading, error } = useQuery({
        queryKey: ['my-profile'],
        queryFn: async () => {
            const { data, error } = await getMyProfile()
            if (error) throw error
            return data as Profile
        },
        staleTime: STALE_5MIN,
    })

    useEffect(() => {
        if (profile) {
            setFormData({
                first_name: profile.first_name ?? '',
                last_name: profile.last_name ?? '',
                phone: profile.phone ?? '',
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
    if (error) return <div className="account-empty"><AlertCircle size={32} strokeWidth={1} /><p>Could not load profile</p></div>

    return (
        <div className="profile-section">
            <div className="profile-avatar">
                <UserIcon size={40} strokeWidth={1} />
            </div>
            <div className="profile-email">{profile?.first_name ? `${profile.first_name} ${profile.last_name ?? ''}`.trim() : user.email}</div>

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
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => updateMutation.mutate(formData)}
                            disabled={updateMutation.isPending}
                        >
                            {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                    </div>
                </div>
            ) : (
                <div className="profile-details">
                    <div className="profile-row"><span>Email</span><span>{user.email}</span></div>
                    <div className="profile-row"><span>Name</span><span>{profile?.first_name} {profile?.last_name}</span></div>
                    <div className="profile-row"><span>Phone</span><span>{profile?.phone || '—'}</span></div>
                    <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)} style={{ marginTop: '1.5rem' }}>
                        <UserIcon size={12} /> Edit Profile
                    </button>
                </div>
            )}
        </div>
    )
}


// ─── MAIN Account Component ───────────────────────────────────────────────────
export default function Account() {
    const { user, loading: authLoading } = useAuth()

    const [mode, setMode] = useState<'login' | 'signup'>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
    const [activeTab, setActiveTab] = useState<Tab>('orders')

    // Forgot password state
    const [forgotMode, setForgotMode] = useState(false)
    const [resetEmail, setResetEmail] = useState('')
    const [resetSent, setResetSent] = useState(false)

    // Post-signup confirmation state
    const [signupEmail, setSignupEmail] = useState<string | null>(null)
    const [resendLoading, setResendLoading] = useState(false)
    const [resendMsg, setResendMsg] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)
        try {
            if (mode === 'signup') {
                const { error } = await supabase.auth.signUp({
                    email, password,
                    options: {
                        data: { full_name: name },
                        emailRedirectTo: window.location.origin + '/account',
                    },
                })
                if (error) throw error
                setSignupEmail(email)
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) throw error
                // onAuthStateChange will update user automatically
            }
        } catch (err) {
            setMessage({ text: mapAuthError((err as Error).message), type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        // onAuthStateChange will clear user automatically
    }

    const handleForgotSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: window.location.origin + '/reset-password',
            })
            if (error) throw error
            setResetSent(true)
        } catch (err) {
            setMessage({ text: mapAuthError((err as Error).message), type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    const handleResend = async () => {
        if (!signupEmail) return
        setResendLoading(true)
        setResendMsg(null)
        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: signupEmail,
                options: { emailRedirectTo: window.location.origin + '/account' },
            })
            if (error) throw error
            setResendMsg('Email resent!')
        } catch (err) {
            setResendMsg((err as Error).message)
        } finally {
            setResendLoading(false)
        }
    }

    const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: 'orders',    label: 'Orders',    icon: <Package size={16} strokeWidth={1.5} /> },
        { key: 'returns',   label: 'Returns',   icon: <RotateCcw size={16} strokeWidth={1.5} /> },
        { key: 'addresses', label: 'Addresses', icon: <MapPin size={16} strokeWidth={1.5} /> },
        { key: 'profile',   label: 'Profile',   icon: <UserIcon size={16} strokeWidth={1.5} /> },
    ]

    if (authLoading) return null

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
                        {activeTab === 'orders'    && <OrdersTab />}
                        {activeTab === 'returns'   && <ReturnsTab />}
                        {activeTab === 'addresses' && <AddressesTab />}
                        {activeTab === 'profile'   && <ProfileTab user={user} />}
                    </div>
                </div>
            </main>
        )
    }

    /* ── Post-signup confirmation ────────────────────────────────── */
    if (signupEmail) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <div className="auth-logo">Color of Nature</div>
                    <div className="auth-confirm-card">
                        <CheckCircle size={36} strokeWidth={1} style={{ color: 'var(--sage)', margin: '0 auto 1rem' }} />
                        <p>We've sent a confirmation link to</p>
                        <strong>{signupEmail}</strong>
                        <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--ink-muted)' }}>
                            Click the link in your email to activate your account.
                        </p>
                        {resendMsg && (
                            <div className="form-message success" style={{ marginTop: '1rem' }}>{resendMsg}</div>
                        )}
                        <button
                            className="btn btn-outline btn-sm"
                            style={{ marginTop: '1.25rem' }}
                            onClick={handleResend}
                            disabled={resendLoading}
                        >
                            {resendLoading ? 'Sending…' : 'Resend email'}
                        </button>
                        <button
                            className="btn btn-ghost btn-sm"
                            style={{ marginTop: '0.5rem' }}
                            onClick={() => { setSignupEmail(null); setEmail(''); setPassword(''); setName('') }}
                        >
                            Use a different email
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    /* ── Forgot password panel ──────────────────────────────────── */
    if (forgotMode) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <div className="auth-logo">Color of Nature</div>
                    {resetSent ? (
                        <div className="auth-confirm-card">
                            <CheckCircle size={36} strokeWidth={1} style={{ color: 'var(--sage)', margin: '0 auto 1rem' }} />
                            <p>Reset link sent to <strong>{resetEmail}</strong></p>
                            <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--ink-muted)' }}>
                                Check your inbox and follow the link to set a new password.
                            </p>
                            <button
                                className="btn btn-ghost btn-sm"
                                style={{ marginTop: '1.25rem' }}
                                onClick={() => { setForgotMode(false); setResetSent(false); setResetEmail('') }}
                            >
                                Back to Sign In
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleForgotSubmit}>
                            <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: '1.3rem', marginBottom: '1.25rem', textAlign: 'center' }}>
                                Reset Password
                            </h2>
                            <div className="form-group">
                                <label className="form-label">Email address</label>
                                <input
                                    className="form-input"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={resetEmail}
                                    onChange={e => setResetEmail(e.target.value)}
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
                                {loading ? 'Sending…' : 'Send Reset Link'}
                            </button>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ width: '100%', justifyContent: 'center', marginTop: '0.75rem' }}
                                onClick={() => { setForgotMode(false); setMessage(null) }}
                            >
                                Back to Sign In
                            </button>
                        </form>
                    )}
                </div>
            </div>
        )
    }

    /* ── Auth form ──────────────────────────────────────────────── */
    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">Color of Nature</div>

                {/* Google Sign-In */}
                <button
                    type="button"
                    className="auth-google-btn"
                    onClick={() => supabase.auth.signInWithOAuth({
                        provider: 'google',
                        options: { redirectTo: window.location.origin + '/account' },
                    })}
                >
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                        <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
                        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
                    </svg>
                    Continue with Google
                </button>

                <div className="auth-divider"><span>or</span></div>

                <div className="auth-tabs">
                    <button className={`auth-tab${mode === 'login' ? ' active' : ''}`} onClick={() => { setMode('login'); setMessage(null) }}>
                        Sign In
                    </button>
                    <button className={`auth-tab${mode === 'signup' ? ' active' : ''}`} onClick={() => { setMode('signup'); setMessage(null) }}>
                        Create Account
                    </button>
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
                        <div className="form-input-wrapper">
                            <input
                                className="form-input" type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••" value={password}
                                onChange={e => setPassword(e.target.value)} required
                            />
                            <button
                                type="button"
                                className="form-input-eye"
                                onClick={() => setShowPassword(v => !v)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                        {mode === 'login' && (
                            <button
                                type="button"
                                className="auth-forgot"
                                onClick={() => { setForgotMode(true); setResetEmail(email); setMessage(null) }}
                            >
                                Forgot password?
                            </button>
                        )}
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
