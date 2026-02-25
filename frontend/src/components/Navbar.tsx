import { Link, useLocation } from 'react-router-dom'
import { ShoppingCart, User } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function Navbar() {
    const { pathname } = useLocation()
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

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
                    <Link to="/cart" aria-label="Cart">
                        <ShoppingCart size={16} strokeWidth={1.5} /> Cart
                    </Link>
                    <Link to="/account" aria-label="Account">
                        <User size={16} strokeWidth={1.5} /> Account
                    </Link>
                </div>
            </div>
        </nav>
    )
}
