import { Link, useLocation } from 'react-router-dom'
import { ShoppingBag, User } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'

function getCartCount(): number {
    try {
        return JSON.parse(localStorage.getItem('cart') || '[]').length
    } catch {
        return 0
    }
}

export default function Navbar() {
    const { pathname } = useLocation()
    const [scrolled, setScrolled] = useState(false)
    const [cartCount, setCartCount] = useState(getCartCount)

    // Recount whenever cart changes
    const refreshCount = useCallback(() => setCartCount(getCartCount()), [])

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('cart-updated', refreshCount)
        window.addEventListener('storage', refreshCount)
        return () => {
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('cart-updated', refreshCount)
            window.removeEventListener('storage', refreshCount)
        }
    }, [refreshCount])

    return (
        <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
            <div className="navbar-inner">
                {/* Left — nav links */}
                <div className="navbar-links">
                    <Link to="/" className={pathname === '/' ? 'active' : ''}>Home</Link>
                    <Link to="/shop" className={pathname === '/shop' ? 'active' : ''}>Shop</Link>
                </div>

                {/* Center — logo */}
                <Link to="/" className="navbar-logo">Color of Nature</Link>

                {/* Right — actions */}
                <div className="navbar-actions">
                    <Link to="/cart" aria-label={`Cart — ${cartCount} items`} className="navbar-cart-link">
                        <ShoppingBag size={16} strokeWidth={1.5} />
                        <span>Cart</span>
                        {cartCount > 0 && (
                            <span className="navbar-cart-badge">{cartCount}</span>
                        )}
                    </Link>
                    <Link to="/account" aria-label="Account">
                        <User size={16} strokeWidth={1.5} /> Account
                    </Link>
                </div>
            </div>
        </nav>
    )
}
