import { Link, useLocation } from 'react-router-dom'
import { ShoppingCart, User } from 'lucide-react'

export default function Navbar() {
    const { pathname } = useLocation()

    return (
        <nav className="navbar">
            <div className="navbar-inner">
                <Link to="/" className="navbar-logo">🌿 Color of Nature</Link>
                <div className="navbar-links">
                    <Link to="/" className={pathname === '/' ? 'active' : ''}>Home</Link>
                    <Link to="/shop" className={pathname === '/shop' ? 'active' : ''}>Shop</Link>
                </div>
                <div className="navbar-actions">
                    <Link to="/cart" className="btn btn-ghost btn-sm">
                        <ShoppingCart size={16} /> Cart
                    </Link>
                    <Link to="/account" className="btn btn-primary btn-sm">
                        <User size={16} /> Account
                    </Link>
                </div>
            </div>
        </nav>
    )
}
