import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react'
import { type Product } from '../lib/supabase'

interface CartItem extends Product { quantity: number }

export default function Cart() {
    const [items, setItems] = useState<CartItem[]>([])

    useEffect(() => {
        const load = () => {
            const raw: Product[] = JSON.parse(localStorage.getItem('cart') || '[]')
            // Group duplicates into quantities
            const map = new Map<number, CartItem>()
            raw.forEach((p) => {
                if (map.has(p.id)) map.get(p.id)!.quantity++
                else map.set(p.id, { ...p, quantity: 1 })
            })
            setItems([...map.values()])
        }
        load()
        window.addEventListener('cart-updated', load)
        return () => window.removeEventListener('cart-updated', load)
    }, [])

    const updateQty = (id: number, delta: number) => {
        setItems((prev) => {
            const next = prev.map((i) => i.id === id ? { ...i, quantity: i.quantity + delta } : i).filter((i) => i.quantity > 0)
            // Rebuild localStorage
            const raw: Product[] = []
            next.forEach((i) => { for (let q = 0; q < i.quantity; q++) raw.push(i) })
            localStorage.setItem('cart', JSON.stringify(raw))
            return next
        })
    }

    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

    if (items.length === 0) {
        return (
            <main className="cart-page">
                <div className="container cart-empty">
                    <div className="cart-empty-icon">🛒</div>
                    <h2 style={{ marginBottom: '0.75rem' }}>Your cart is empty</h2>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
                        Head over to the shop and pick something natural!
                    </p>
                    <Link to="/shop" className="btn btn-primary">
                        <ShoppingBag size={16} /> Browse Products
                    </Link>
                </div>
            </main>
        )
    }

    return (
        <main className="cart-page">
            <div className="container">
                <div className="section-header" style={{ textAlign: 'left', marginBottom: '2rem' }}>
                    <h1 className="section-title" style={{ marginBottom: 0 }}>Your Cart</h1>
                    <p style={{ color: 'var(--color-text-muted)' }}>{items.length} item{items.length !== 1 ? 's' : ''}</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem', alignItems: 'start' }}>
                    <div>
                        {items.map((item) => (
                            <div className="cart-item" key={item.id}>
                                <div className="cart-item-image"
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', background: 'var(--color-surface-hover)' }}>
                                    {item.image_url ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} /> : '🌿'}
                                </div>
                                <div className="cart-item-info">
                                    <div className="cart-item-name">{item.name}</div>
                                    <div className="cart-item-price">₹{item.price.toFixed(2)}</div>
                                </div>
                                <div className="cart-item-qty">
                                    <button onClick={() => updateQty(item.id, -1)}><Minus size={14} /></button>
                                    <span style={{ fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                                    <button onClick={() => updateQty(item.id, 1)}><Plus size={14} /></button>
                                </div>
                                <button onClick={() => updateQty(item.id, -item.quantity)} style={{ color: '#f87171', padding: '0.4rem', borderRadius: '6px' }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="cart-summary">
                        <h3 style={{ marginBottom: '1.25rem', fontFamily: 'Playfair Display, serif' }}>Order Summary</h3>
                        <div className="cart-summary-row"><span>Subtotal</span><span>₹{total.toFixed(2)}</span></div>
                        <div className="cart-summary-row"><span>Shipping</span><span style={{ color: 'var(--color-secondary)' }}>{total >= 999 ? 'Free' : '₹99'}</span></div>
                        <div className="cart-summary-total">
                            <span>Total</span>
                            <span className="cart-total-amount">₹{(total >= 999 ? total : total + 99).toFixed(2)}</span>
                        </div>
                        <Link to="/account" className="btn btn-primary" style={{ width: '100%', marginTop: '1.25rem', justifyContent: 'center' }}>
                            Proceed to Checkout
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    )
}
