import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import {
    getServerCart, upsertServerCartItem, removeFromServerCart,
} from '../lib/supabase'
import type { Product, ProductImage, ServerCartItem } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalCartItem extends Product {
    qty: number
    product_images?: ProductImage[]
}

// ─── Local cart helpers (anonymous users) ────────────────────────────────────

function loadLocalCart(): LocalCartItem[] {
    const raw: Product[] = JSON.parse(localStorage.getItem('cart') || '[]')
    const map = new Map<number, LocalCartItem>()
    raw.forEach((p) => {
        if (map.has(p.id)) map.get(p.id)!.qty++
        else map.set(p.id, { ...p, qty: 1 })
    })
    return Array.from(map.values())
}

function saveLocalCart(items: LocalCartItem[]) {
    const flat: Product[] = items.flatMap((i) => Array(i.qty).fill(i))
    localStorage.setItem('cart', JSON.stringify(flat))
}

// ─── Server cart display item ─────────────────────────────────────────────────

function serverToDisplay(item: ServerCartItem) {
    return {
        cartId: item.id,
        productId: item.product_id,
        variantId: item.variant_id,
        qty: item.quantity,
        name: item.product.name,
        price: item.product.price + (item.variant?.price_adjustment ?? 0),
        category: item.product.category,
        image_url: item.product.image_url,
        product_images: item.product.product_images,
        size: item.variant?.size ?? null,
        color: item.variant?.color ?? null,
    }
}

// ─── Cart Page ────────────────────────────────────────────────────────────────

export default function Cart() {
    const { user } = useAuth()
    const queryClient = useQueryClient()

    // ── Server cart (logged-in) ───────────────────────────────────────────────
    const { data: serverItems = [] } = useQuery({
        queryKey: ['cart'],
        queryFn: getServerCart,
        enabled: !!user,
        staleTime: 60 * 1000,
    })

    const updateMutation = useMutation({
        mutationFn: ({ productId, variantId, qty }: { productId: number; variantId: number | null; qty: number }) =>
            upsertServerCartItem(productId, variantId, qty),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
    })

    const removeMutation = useMutation({
        mutationFn: ({ productId, variantId }: { productId: number; variantId: number | null }) =>
            removeFromServerCart(productId, variantId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cart'] })
            window.dispatchEvent(new Event('cart-updated'))
        },
    })

    // ── Local cart (anonymous) ────────────────────────────────────────────────
    const [localItems, setLocalItems] = useState<LocalCartItem[]>([])

    useEffect(() => {
        if (user) return
        const load = () => setLocalItems(loadLocalCart())
        load()
        window.addEventListener('cart-updated', load)
        return () => window.removeEventListener('cart-updated', load)
    }, [user])

    const updateLocalQty = (id: number, delta: number) => {
        setLocalItems((prev) => {
            const next = prev
                .map((i) => i.id === id ? { ...i, qty: i.qty + delta } : i)
                .filter((i) => i.qty > 0)
            saveLocalCart(next)
            window.dispatchEvent(new Event('cart-updated'))
            return next
        })
    }

    const removeLocal = (id: number) => {
        setLocalItems((prev) => {
            const next = prev.filter((i) => i.id !== id)
            saveLocalCart(next)
            window.dispatchEvent(new Event('cart-updated'))
            return next
        })
    }

    // ── Unified display ───────────────────────────────────────────────────────

    if (user) {
        const displayItems = serverItems.map(serverToDisplay)
        const subtotal = displayItems.reduce((s, i) => s + i.price * i.qty, 0)
        const shipping = subtotal > 999 ? 0 : 99
        const total = subtotal + shipping

        if (displayItems.length === 0) return <EmptyCart />

        return (
            <main className="cart-page">
                <div className="container">
                    <h1 className="cart-title">Your Cart</h1>
                    <div className="cart-grid">
                        <div>
                            {displayItems.map((item) => (
                                <div className="cart-item" key={item.cartId}>
                                    <CartImage name={item.name} imageUrl={item.image_url} images={item.product_images} />
                                    <div className="cart-item-info">
                                        {item.category && <div className="cart-item-category">{item.category}</div>}
                                        <div className="cart-item-name">{item.name}</div>
                                        {(item.size || item.color) && (
                                            <div style={{ fontSize: '0.78rem', color: 'var(--sage)', marginTop: '0.2rem' }}>
                                                {[item.size, item.color].filter(Boolean).join(' · ')}
                                            </div>
                                        )}
                                    </div>
                                    <div className="cart-item-controls">
                                        <div className="cart-item-price">₹{(item.price * item.qty).toFixed(2)}</div>
                                        <div className="cart-item-qty">
                                            <button
                                                onClick={() => item.qty > 1
                                                    ? updateMutation.mutate({ productId: item.productId, variantId: item.variantId, qty: item.qty - 1 })
                                                    : removeMutation.mutate({ productId: item.productId, variantId: item.variantId })
                                                }
                                            >−</button>
                                            <span>{item.qty}</span>
                                            <button onClick={() => updateMutation.mutate({ productId: item.productId, variantId: item.variantId, qty: item.qty + 1 })}>+</button>
                                        </div>
                                        <button className="cart-item-remove" onClick={() => removeMutation.mutate({ productId: item.productId, variantId: item.variantId })}>Remove</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <CartSummary subtotal={subtotal} shipping={shipping} total={total} />
                    </div>
                </div>
            </main>
        )
    }

    // Anonymous (localStorage)
    const subtotal = localItems.reduce((s, i) => s + i.price * i.qty, 0)
    const shipping = subtotal > 999 ? 0 : 99
    const total = subtotal + shipping

    if (localItems.length === 0) return <EmptyCart />

    return (
        <main className="cart-page">
            <div className="container">
                <h1 className="cart-title">Your Cart</h1>
                <div className="cart-grid">
                    <div>
                        {localItems.map((item) => (
                            <div className="cart-item" key={item.id}>
                                <CartImage name={item.name} imageUrl={item.image_url} images={item.product_images} />
                                <div className="cart-item-info">
                                    {item.category && <div className="cart-item-category">{item.category}</div>}
                                    <div className="cart-item-name">{item.name}</div>
                                </div>
                                <div className="cart-item-controls">
                                    <div className="cart-item-price">₹{(item.price * item.qty).toFixed(2)}</div>
                                    <div className="cart-item-qty">
                                        <button onClick={() => updateLocalQty(item.id, -1)}>−</button>
                                        <span>{item.qty}</span>
                                        <button onClick={() => updateLocalQty(item.id, 1)}>+</button>
                                    </div>
                                    <button className="cart-item-remove" onClick={() => removeLocal(item.id)}>Remove</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <CartSummary subtotal={subtotal} shipping={shipping} total={total} />
                </div>
            </div>
        </main>
    )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function CartImage({ name, imageUrl, images }: { name: string; imageUrl: string | null; images?: ProductImage[] }) {
    const src = images?.find(i => i.is_primary)?.image_url ?? images?.[0]?.image_url ?? imageUrl
    return (
        <div className="cart-item-image">
            {src
                ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '2rem' }}>🌿</span>}
        </div>
    )
}

function CartSummary({ subtotal, shipping, total }: { subtotal: number; shipping: number; total: number }) {
    return (
        <div className="cart-summary">
            <div className="cart-summary-title">Order Summary</div>
            <div className="cart-summary-row">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="cart-summary-row">
                <span>Shipping</span>
                <span>{shipping === 0 ? 'Free' : `₹${shipping}`}</span>
            </div>
            {subtotal < 999 && (
                <div className="cart-summary-row" style={{ fontSize: '0.78rem', color: 'var(--sage)' }}>
                    Add ₹{(999 - subtotal).toFixed(0)} more for free shipping
                </div>
            )}
            <div className="cart-summary-total">
                <span>Total</span>
                <span>₹{total.toFixed(2)}</span>
            </div>
            <Link to="/checkout" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '1.5rem' }}>
                Checkout
            </Link>
            <Link to="/shop" className="btn btn-ghost" style={{ marginTop: '1rem', justifyContent: 'center', display: 'flex' }}>
                Continue Shopping
            </Link>
        </div>
    )
}

function EmptyCart() {
    return (
        <main className="cart-page">
            <div className="container">
                <h1 className="cart-title">Your Cart</h1>
                <div className="cart-empty">
                    <div className="cart-empty-icon">🛒</div>
                    <p>Your cart is empty.</p>
                    <Link to="/shop" className="btn btn-outline">Continue Shopping</Link>
                </div>
            </div>
        </main>
    )
}
