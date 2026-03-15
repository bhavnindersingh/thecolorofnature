import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { MapPin, CheckCircle, AlertCircle, ChevronDown, Package } from 'lucide-react'
import { getMyAddresses, createOrder, syncOrderToOdoo } from '../lib/supabase'
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
    onSelect: (addr: Address | Record<string, string>, id?: string) => void
}) {
    const [showNew, setShowNew] = useState(false)
    const [form, setForm] = useState(BLANK_ADDR)
    const [open, setOpen] = useState(false)

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
                <div>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">First Name *</label>
                            <input className="form-input" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Last Name</label>
                            <input className="form-input" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Address Line 1 *</label>
                        <input className="form-input" value={form.address_line_1} onChange={e => setForm({ ...form, address_line_1: e.target.value })} placeholder="123 Main Street" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Address Line 2</label>
                        <input className="form-input" value={form.address_line_2} onChange={e => setForm({ ...form, address_line_2: e.target.value })} placeholder="Apt, Suite, etc." />
                    </div>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">City *</label>
                            <input className="form-input" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">State</label>
                            <input className="form-input" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Postal Code *</label>
                            <input className="form-input" value={form.postal_code} onChange={e => setForm({ ...form, postal_code: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Phone</label>
                        <input className="form-input" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91..." />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <button
                            className="btn btn-outline btn-sm"
                            disabled={!newFormValid}
                            onClick={() => { onSelect(form); setShowNew(false) }}
                        >
                            Use This Address
                        </button>
                        {!!addresses?.length && (
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowNew(false)}>Back to saved</button>
                        )}
                    </div>
                </div>
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

    const placeMutation = useMutation({
        mutationFn: async () => {
            if (!selectedAddr) throw new Error('Please select a shipping address')
            if (!user) throw new Error('Not logged in')

            // Build address as plain object for Supabase
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

            // 1. Create order in Supabase
            const order = await createOrder(orderItems, addrPayload, total, selectedAddrId)

            // 2. Sync to Odoo (best-effort — don't block user if it fails)
            const odooItems = items.flatMap((i) => {
                const variant = i.product_variants?.[0]
                if (!variant?.odoo_variant_id) return []
                return [{ odoo_variant_id: variant.odoo_variant_id, quantity: i.qty, price: i.price }]
            })
            if (odooItems.length > 0) {
                const fullName = user.user_metadata?.full_name ?? user.email ?? ''
                syncOrderToOdoo(order.id, user.email ?? '', fullName, odooItems)
                    .catch((err) => setOdooError(String(err?.message ?? err)))
            }

            return order
        },
        onSuccess: (order) => {
            localStorage.setItem('cart', '[]')
            window.dispatchEvent(new Event('cart-updated'))
            setPlacedOrderId(order.id)
        },
    })

    // ── Success screen ────────────────────────────────────────────────────────
    if (placedOrderId) {
        return (
            <main className="checkout-page">
                <div className="container">
                    <div className="checkout-success">
                        <CheckCircle size={56} strokeWidth={1} className="checkout-success-icon" />
                        <h1>Order Placed!</h1>
                        <p>Thank you for your order. We'll send you a confirmation soon.</p>
                        <div className="checkout-success-ref">
                            Order ref: <strong>#{placedOrderId.slice(0, 8).toUpperCase()}</strong>
                        </div>
                        {odooError && (
                            <div className="checkout-odoo-warn">
                                <AlertCircle size={14} /> Order saved, but Odoo sync had an issue: {odooError}
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

    // ── Checkout form ─────────────────────────────────────────────────────────
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
                                onSelect={(addr, id) => { setSelectedAddr(addr); setSelectedAddrId(id) }}
                            />
                        </div>
                    </div>

                    {/* Right: Summary + Place Order */}
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
                                                    : <span>🌿</span>}
                                                <span className="checkout-item-qty">{item.qty}</span>
                                            </div>
                                            <div className="checkout-item-name">{item.name}</div>
                                            <div className="checkout-item-price">₹{(item.price * item.qty).toFixed(2)}</div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="checkout-totals">
                                <div className="checkout-total-row">
                                    <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
                                </div>
                                <div className="checkout-total-row">
                                    <span>Shipping</span>
                                    <span>{shipping === 0 ? 'Free' : `₹${shipping}`}</span>
                                </div>
                                {subtotal < 999 && (
                                    <div className="checkout-total-row" style={{ fontSize: '0.78rem', color: 'var(--sage)' }}>
                                        <span>Add ₹{(999 - subtotal).toFixed(0)} more for free shipping</span>
                                    </div>
                                )}
                                <div className="checkout-total-row checkout-grand-total">
                                    <span>Total</span><span>₹{total.toFixed(2)}</span>
                                </div>
                            </div>

                            {placeMutation.error && (
                                <div className="form-message error" style={{ marginBottom: '1rem' }}>
                                    {(placeMutation.error as Error).message}
                                </div>
                            )}

                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', justifyContent: 'center' }}
                                disabled={!selectedAddr || placeMutation.isPending}
                                onClick={() => placeMutation.mutate()}
                            >
                                {placeMutation.isPending ? 'Placing Order…' : 'Place Order'}
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
