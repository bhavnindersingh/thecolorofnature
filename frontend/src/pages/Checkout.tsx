import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { MapPin, CheckCircle, AlertCircle, ChevronDown, Package, CreditCard, Lock, ArrowLeft } from 'lucide-react'
import { getMyAddresses, createOrder, confirmOrderPayment, addAddress } from '../lib/supabase'
import PlacesAutocomplete from '../components/PlacesAutocomplete'
import type { Address, Product } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface CartItem extends Product {
    qty: number
}

function loadCart(): CartItem[] {
    const raw: Product[] = JSON.parse(localStorage.getItem('cart') || '[]')
    const map = new Map<number, CartItem>()
    raw.forEach((p) => {
        if (map.has(p.id)) map.get(p.id)!.qty++
        else map.set(p.id, { ...p, qty: 1 })
    })
    return Array.from(map.values())
}

type Step = 'address' | 'payment' | 'success'

// ─── Address picker ───────────────────────────────────────────────────────────
const BLANK_ADDR = {
    first_name: '', last_name: '', address_line_1: '', address_line_2: '',
    city: '', state: '', postal_code: '', country: 'India', phone: '',
}

function AddressPicker({
    selected,
    onSelect,
}: {
    selected: Address | Record<string, string> | null
    onSelect: (addr: Address | Record<string, string>, id?: string, shouldSave?: boolean) => void
}) {
    const [showNew, setShowNew] = useState(false)
    const [form, setForm] = useState(BLANK_ADDR)
    const [open, setOpen] = useState(false)
    const [saveToProfile, setSaveToProfile] = useState(false)

    const { data: addresses } = useQuery({
        queryKey: ['my-addresses'],
        queryFn: async () => {
            const { data, error } = await getMyAddresses()
            if (error) throw error
            return data as Address[]
        },
        staleTime: 5 * 60 * 1000,
    })

    // Auto-select default address
    useEffect(() => {
        if (addresses?.length && !selected) {
            const def = addresses.find(a => a.is_default) ?? addresses[0]
            onSelect(def, def.id)
        }
    }, [addresses])

    const savedLabel = (addr: Address) =>
        `${addr.first_name} ${addr.last_name}, ${addr.address_line_1}, ${addr.city}`

    const newFormValid = form.first_name.trim() && form.address_line_1.trim() && form.city.trim() && form.postal_code.trim()

    return (
        <div className="checkout-address-picker">
            {/* Saved addresses */}
            {!!addresses?.length && !showNew && (
                <div>
                    <div className="checkout-addr-dropdown" onClick={() => setOpen(o => !o)}>
                        <span>
                            {selected && 'id' in selected
                                ? savedLabel(selected as Address)
                                : 'Select a saved address'}
                        </span>
                        <ChevronDown size={16} />
                    </div>
                    {open && (
                        <div className="checkout-addr-list">
                            {addresses.map((addr) => (
                                <div
                                    key={addr.id}
                                    className={`checkout-addr-option${selected && 'id' in selected && (selected as Address).id === addr.id ? ' selected' : ''}`}
                                    onClick={() => { onSelect(addr, addr.id); setOpen(false) }}
                                >
                                    <div className="checkout-addr-option-name">{addr.first_name} {addr.last_name} {addr.is_default && <span className="address-default-badge" style={{ fontSize: '0.68rem' }}>Default</span>}</div>
                                    <div className="checkout-addr-option-text">{addr.address_line_1}, {addr.city}, {addr.state} {addr.postal_code}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: '0.75rem' }} onClick={() => setShowNew(true)}>
                        <MapPin size={12} /> Use a different address
                    </button>
                </div>
            )}

            {/* New address form */}
            {(!addresses?.length || showNew) && (
                <form onSubmit={e => { e.preventDefault(); if (newFormValid) { onSelect(form, undefined, saveToProfile); setShowNew(false) } }}>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">First Name *</label>
                            <input className="form-input" autoComplete="given-name" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Last Name</label>
                            <input className="form-input" autoComplete="family-name" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Address Line 1 *</label>
                        <PlacesAutocomplete
                            value={form.address_line_1}
                            onChange={(val) => setForm(f => ({ ...f, address_line_1: val }))}
                            onPlaceSelect={(r) => setForm(f => ({
                                ...f,
                                address_line_1: r.address_line_1 || f.address_line_1,
                                city:           r.city        || f.city,
                                state:          r.state       || f.state,
                                postal_code:    r.postal_code || f.postal_code,
                                country:        r.country     || f.country,
                            }))}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Address Line 2</label>
                        <input className="form-input" autoComplete="address-line2" value={form.address_line_2} onChange={e => setForm({ ...form, address_line_2: e.target.value })} placeholder="Apt, Suite, etc." />
                    </div>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">City *</label>
                            <input className="form-input" autoComplete="address-level2" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">State</label>
                            <input className="form-input" autoComplete="address-level1" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Postal Code *</label>
                            <input className="form-input" autoComplete="postal-code" value={form.postal_code} onChange={e => setForm({ ...form, postal_code: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Phone</label>
                        <input className="form-input" type="tel" autoComplete="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91..." />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={saveToProfile}
                            onChange={e => setSaveToProfile(e.target.checked)}
                            style={{ accentColor: 'var(--sage, #4a5e3a)', width: 'auto' }}
                        />
                        Save this address to my profile
                    </label>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <button
                            type="submit"
                            className="btn btn-outline btn-sm"
                            disabled={!newFormValid}
                        >
                            Use This Address
                        </button>
                        {!!addresses?.length && (
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNew(false)}>Back to saved</button>
                        )}
                    </div>
                </form>
            )}
        </div>
    )
}


// ─── Main Checkout Page ───────────────────────────────────────────────────────
export default function Checkout() {
    const navigate = useNavigate()
    const [items] = useState<CartItem[]>(loadCart)
    const [selectedAddr, setSelectedAddr] = useState<Address | Record<string, string> | null>(null)
    const [selectedAddrId, setSelectedAddrId] = useState<string | undefined>(undefined)
    const [shouldSaveAddr, setShouldSaveAddr] = useState(false)
    const [step, setStep] = useState<Step>('address')
    const [pendingOrderId, setPendingOrderId] = useState<string | null>(null)
    const [placedOrderId, setPlacedOrderId] = useState<string | null>(null)
    const [odooError, setOdooError] = useState<string | null>(null)

    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
    const shipping = subtotal > 999 ? 0 : 99
    const total = subtotal + shipping

    // Auth check
    const { user, loading: authLoading } = useAuth()

    // Redirect if not logged in or cart empty
    useEffect(() => {
        if (authLoading) return
        if (!user) navigate('/account', { replace: true })
        if (items.length === 0) navigate('/cart', { replace: true })
    }, [user, authLoading, items.length])

    // Step 1: Create order in Supabase (status: pending)
    const createMutation = useMutation({
        mutationFn: async () => {
            if (!selectedAddr) throw new Error('Please select a shipping address')
            if (!user) throw new Error('Not logged in')

            const addrPayload: Record<string, string> = {
                first_name:      String(selectedAddr.first_name ?? ''),
                last_name:       String((selectedAddr as Address).last_name ?? ''),
                address_line_1:  String(selectedAddr.address_line_1 ?? ''),
                address_line_2:  String((selectedAddr as Address).address_line_2 ?? ''),
                city:            String(selectedAddr.city ?? ''),
                state:           String((selectedAddr as Address).state ?? ''),
                postal_code:     String(selectedAddr.postal_code ?? ''),
                country:         String(selectedAddr.country ?? 'India'),
                phone:           String((selectedAddr as Address).phone ?? ''),
            }

            const orderItems = items.map((i) => ({
                product_id: i.id,
                quantity: i.qty,
                unit_price: i.price,
            }))

            const order = await createOrder(orderItems, addrPayload, total, selectedAddrId)

            // Save address to profile if user requested and it's a new (unsaved) address
            if (shouldSaveAddr && !selectedAddrId && selectedAddr) {
                try {
                    await addAddress({
                        label:          'Other',
                        first_name:     addrPayload.first_name,
                        last_name:      addrPayload.last_name,
                        address_line_1: addrPayload.address_line_1,
                        address_line_2: addrPayload.address_line_2 || null,
                        city:           addrPayload.city,
                        state:          addrPayload.state || null,
                        postal_code:    addrPayload.postal_code,
                        country:        addrPayload.country,
                        phone:          addrPayload.phone || null,
                        is_default:     false,
                    })
                } catch {
                    // Non-critical — order is placed; silently skip if save fails
                }
            }

            return order
        },
        onSuccess: (order) => {
            setPendingOrderId(order.id)
            setStep('payment')
        },
    })

    // Step 2: Confirm payment (dummy) and sync to Odoo
    const confirmMutation = useMutation({
        mutationFn: async () => {
            if (!pendingOrderId) throw new Error('No pending order')
            const { data, error } = await confirmOrderPayment(pendingOrderId)
            if (error) throw new Error(typeof error === 'string' ? error : 'Payment confirmation failed')
            if (data?.odoo_error) setOdooError(data.odoo_error)
            return data
        },
        onSuccess: () => {
            localStorage.setItem('cart', '[]')
            window.dispatchEvent(new Event('cart-updated'))
            setPlacedOrderId(pendingOrderId)
            setStep('success')
        },
    })

    // ── Success screen ────────────────────────────────────────────────────────
    if (step === 'success' && placedOrderId) {
        return (
            <main className="checkout-page">
                <div className="container">
                    <div className="checkout-success">
                        <CheckCircle size={56} strokeWidth={1} className="checkout-success-icon" />
                        <h1>Order Confirmed!</h1>
                        <p>Thank you for your order. We'll send you a confirmation soon.</p>
                        <div className="checkout-success-ref">
                            Order ref: <strong>#{placedOrderId.slice(0, 8).toUpperCase()}</strong>
                        </div>
                        {odooError && (
                            <div className="checkout-odoo-warn">
                                <AlertCircle size={14} /> Order saved, but warehouse sync had an issue: {odooError}
                            </div>
                        )}
                        <div className="checkout-success-actions">
                            <Link to="/account" className="btn btn-primary">View My Orders</Link>
                            <Link to="/shop" className="btn btn-ghost">Continue Shopping</Link>
                        </div>
                    </div>
                </div>
            </main>
        )
    }

    if (authLoading) return null

    // ── Payment step ─────────────────────────────────────────────────────────
    if (step === 'payment') {
        return (
            <main className="checkout-page">
                <div className="container">
                    <h1 className="checkout-title">Payment</h1>

                    <div className="checkout-grid">
                        <div className="checkout-left">
                            <div className="checkout-section">
                                <div className="checkout-section-title">
                                    <CreditCard size={16} strokeWidth={1.5} /> Payment Method
                                </div>

                                {/* Dummy card UI */}
                                <div style={{
                                    background: 'linear-gradient(135deg, #4a5e3a 0%, #2d3a24 100%)',
                                    borderRadius: '12px',
                                    padding: '24px',
                                    color: '#fff',
                                    marginBottom: '1.5rem',
                                    fontFamily: 'monospace',
                                }}>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '16px' }}>CARD NUMBER</div>
                                    <div style={{ fontSize: '1.2rem', letterSpacing: '3px', marginBottom: '20px' }}>
                                        **** **** **** 4242
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                        <div>
                                            <div style={{ opacity: 0.7, fontSize: '0.65rem' }}>CARDHOLDER</div>
                                            <div>DEMO USER</div>
                                        </div>
                                        <div>
                                            <div style={{ opacity: 0.7, fontSize: '0.65rem' }}>EXPIRES</div>
                                            <div>12/28</div>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--sage)', fontSize: '0.82rem', marginBottom: '1rem' }}>
                                    <Lock size={14} />
                                    <span>This is a demo payment — no real charges will be made.</span>
                                </div>

                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setStep('address')}
                                    style={{ marginTop: '0.5rem' }}
                                >
                                    <ArrowLeft size={12} /> Back to Shipping
                                </button>
                            </div>
                        </div>

                        <div className="checkout-right">
                            <div className="checkout-section">
                                <div className="checkout-section-title">
                                    <Package size={16} strokeWidth={1.5} /> Order Summary
                                </div>

                                <div className="checkout-items">
                                    {items.map((item) => {
                                        const img =
                                            item.product_images?.find(i => i.is_primary)?.image_url
                                            ?? item.product_images?.[0]?.image_url
                                            ?? item.image_url
                                        return (
                                            <div className="checkout-item" key={item.id}>
                                                <div className="checkout-item-thumb">
                                                    {img
                                                        ? <img src={img} alt={item.name} />
                                                        : <span>~</span>}
                                                    <span className="checkout-item-qty">{item.qty}</span>
                                                </div>
                                                <div className="checkout-item-name">{item.name}</div>
                                                <div className="checkout-item-price">{'\u20B9'}{(item.price * item.qty).toFixed(2)}</div>
                                            </div>
                                        )
                                    })}
                                </div>

                                <div className="checkout-totals">
                                    <div className="checkout-total-row">
                                        <span>Subtotal</span><span>{'\u20B9'}{subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="checkout-total-row">
                                        <span>Shipping</span>
                                        <span>{shipping === 0 ? 'Free' : `\u20B9${shipping}`}</span>
                                    </div>
                                    <div className="checkout-total-row checkout-grand-total">
                                        <span>Total</span><span>{'\u20B9'}{total.toFixed(2)}</span>
                                    </div>
                                </div>

                                {confirmMutation.error && (
                                    <div className="form-message error" style={{ marginBottom: '1rem' }}>
                                        {(confirmMutation.error as Error).message}
                                    </div>
                                )}

                                <button
                                    className="btn btn-primary"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                    disabled={confirmMutation.isPending}
                                    onClick={() => confirmMutation.mutate()}
                                >
                                    {confirmMutation.isPending ? 'Processing Payment...' : `Confirm Payment \u2014 \u20B9${total.toFixed(2)}`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        )
    }

    // ── Address step (default) ───────────────────────────────────────────────
    return (
        <main className="checkout-page">
            <div className="container">
                <h1 className="checkout-title">Checkout</h1>

                <div className="checkout-grid">
                    {/* Left: Shipping */}
                    <div className="checkout-left">
                        <div className="checkout-section">
                            <div className="checkout-section-title">
                                <MapPin size={16} strokeWidth={1.5} /> Shipping Address
                            </div>
                            <AddressPicker
                                selected={selectedAddr}
                                onSelect={(addr, id, shouldSave) => { setSelectedAddr(addr); setSelectedAddrId(id); setShouldSaveAddr(shouldSave ?? false) }}
                            />
                        </div>
                    </div>

                    {/* Right: Summary + Review & Pay */}
                    <div className="checkout-right">
                        <div className="checkout-section">
                            <div className="checkout-section-title">
                                <Package size={16} strokeWidth={1.5} /> Order Summary
                            </div>

                            <div className="checkout-items">
                                {items.map((item) => {
                                    const img =
                                        item.product_images?.find(i => i.is_primary)?.image_url
                                        ?? item.product_images?.[0]?.image_url
                                        ?? item.image_url
                                    return (
                                        <div className="checkout-item" key={item.id}>
                                            <div className="checkout-item-thumb">
                                                {img
                                                    ? <img src={img} alt={item.name} />
                                                    : <span>~</span>}
                                                <span className="checkout-item-qty">{item.qty}</span>
                                            </div>
                                            <div className="checkout-item-name">{item.name}</div>
                                            <div className="checkout-item-price">{'\u20B9'}{(item.price * item.qty).toFixed(2)}</div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="checkout-totals">
                                <div className="checkout-total-row">
                                    <span>Subtotal</span><span>{'\u20B9'}{subtotal.toFixed(2)}</span>
                                </div>
                                <div className="checkout-total-row">
                                    <span>Shipping</span>
                                    <span>{shipping === 0 ? 'Free' : `\u20B9${shipping}`}</span>
                                </div>
                                {subtotal < 999 && (
                                    <div className="checkout-total-row" style={{ fontSize: '0.78rem', color: 'var(--sage)' }}>
                                        <span>Add {'\u20B9'}{(999 - subtotal).toFixed(0)} more for free shipping</span>
                                    </div>
                                )}
                                <div className="checkout-total-row checkout-grand-total">
                                    <span>Total</span><span>{'\u20B9'}{total.toFixed(2)}</span>
                                </div>
                            </div>

                            {createMutation.error && (
                                <div className="form-message error" style={{ marginBottom: '1rem' }}>
                                    {(createMutation.error as Error).message}
                                </div>
                            )}

                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', justifyContent: 'center' }}
                                disabled={!selectedAddr || createMutation.isPending}
                                onClick={() => createMutation.mutate()}
                            >
                                {createMutation.isPending ? 'Preparing Order...' : 'Review & Pay'}
                            </button>

                            <Link to="/cart" className="btn btn-ghost" style={{ display: 'flex', justifyContent: 'center', marginTop: '0.75rem' }}>
                                Back to Cart
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}
