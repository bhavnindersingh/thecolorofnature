import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Product } from '../lib/supabase'

interface CartItem extends Product { qty: number }

export default function Cart() {
    const [items, setItems] = useState<CartItem[]>([])

    useEffect(() => {
        const load = () => {
            const raw: Product[] = JSON.parse(localStorage.getItem('cart') || '[]')
            const map = new Map<number, CartItem>()
            raw.forEach((p) => {
                if (map.has(p.id)) map.get(p.id)!.qty++
                else map.set(p.id, { ...p, qty: 1 })
            })
            setItems(Array.from(map.values()))
        }
        load()
        window.addEventListener('cart-updated', load)
        return () => window.removeEventListener('cart-updated', load)
    }, [])

    const updateQty = (id: number, delta: number) => {
        setItems((prev) => {
            const next = prev
                .map((i) => i.id === id ? { ...i, qty: i.qty + delta } : i)
                .filter((i) => i.qty > 0)
            const flat: Product[] = next.flatMap((i) => Array(i.qty).fill(i))
            localStorage.setItem('cart', JSON.stringify(flat))
            return next
        })
    }

    const remove = (id: number) => {
        setItems((prev) => {
            const next = prev.filter((i) => i.id !== id)
            const flat: Product[] = next.flatMap((i) => Array(i.qty).fill(i))
            localStorage.setItem('cart', JSON.stringify(flat))
            return next
        })
    }

    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
    const shipping = subtotal > 999 ? 0 : 99
    const total = subtotal + shipping

    if (items.length === 0) {
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

    return (
        <main className="cart-page">
            <div className="container">
                <h1 className="cart-title">Your Cart</h1>

                <div className="cart-grid">
                    {/* Items */}
                    <div>
                        {items.map((item) => (
                            <div className="cart-item" key={item.id}>
                                <div className="cart-item-image" style={{
                                    display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontSize: '2rem',
                                    background: 'var(--bg-alt)',
                                }}>
                                    {item.image_url
                                        ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : '🌿'
                                    }
                                </div>
                                <div className="cart-item-info">
                                    {item.category && <div className="cart-item-category">{item.category}</div>}
                                    <div className="cart-item-name">{item.name}</div>
                                </div>
                                <div className="cart-item-controls">
                                    <div className="cart-item-price">₹{(item.price * item.qty).toFixed(2)}</div>
                                    <div className="cart-item-qty">
                                        <button onClick={() => updateQty(item.id, -1)}>−</button>
                                        <span>{item.qty}</span>
                                        <button onClick={() => updateQty(item.id, 1)}>+</button>
                                    </div>
                                    <button className="cart-item-remove" onClick={() => remove(item.id)}>Remove</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Summary */}
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
                        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '1.5rem' }}>
                            Checkout
                        </button>
                        <Link to="/shop" className="btn btn-ghost" style={{ marginTop: '1rem', justifyContent: 'center', display: 'flex' }}>
                            Continue Shopping
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    )
}
