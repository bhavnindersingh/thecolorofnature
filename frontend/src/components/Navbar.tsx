import { Link, useLocation } from 'react-router-dom'
import { ShoppingBag, User } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { getServerCart } from '../lib/supabase'

function getLocalCartCount(): number {
    try {
        return JSON.parse(localStorage.getItem('cart') || '[]').length
    } catch {
        return 0
    }
}

export default function Navbar() {
    const { pathname } = useLocation()
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [scrolled, setScrolled] = useState(false)

    // Server cart count (logged-in users)
    const { data: serverCart } = useQuery({
        queryKey: ['cart'],
        queryFn: getServerCart,
        enabled: !!user,
        staleTime: 60 * 1000,
    })

    // Local cart count (anonymous users)
    const [localCount, setLocalCount] = useState(getLocalCartCount)
    const refreshLocalCount = useCallback(() => setLocalCount(getLocalCartCount()), [])

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', onScroll, { passive: true })

        // On cart-updated: refresh local count (anonymous) or invalidate server query (logged-in)
        const onCartUpdated = () => {
            if (user) {
                queryClient.invalidateQueries({ queryKey: ['cart'] })
            } else {
                refreshLocalCount()
            }
        }
        window.addEventListener('cart-updated', onCartUpdated)
        window.addEventListener('storage', refreshLocalCount)

        return () => {
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('cart-updated', onCartUpdated)
            window.removeEventListener('storage', refreshLocalCount)
        }
    }, [user, queryClient, refreshLocalCount])

    const cartCount = user
        ? (serverCart?.reduce((sum, item) => sum + item.quantity, 0) ?? 0)
        : localCount

    return (
        <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
            <div className="navbar-inner">
                {/* Left — nav links */}
                <div className="navbar-links">
                    <Link to="/" className={pathname === '/' ? 'active' : ''}>home</Link>
                    <Link to="/shop" className={pathname === '/shop' ? 'active' : ''}>Shop</Link>
                    <Link to="/process" className={pathname === '/process' ? 'active' : ''}>Our process</Link>
                </div>

                {/* Center — logo */}
                <Link to="/" className="navbar-logo">The Colours of Nature</Link>

                {/* Right — actions */}
                <div className="navbar-actions">
                    <Link to="/about" className={pathname === '/about' ? 'active' : ''}>about</Link>
                    <Link to="/partnerships" className={pathname === '/partnerships' ? 'active' : ''}>Partnerships</Link>
                    <Link to="/cart" aria-label={`Bag — ${cartCount} items`} className="navbar-cart-link">
                        <span>Bag</span>
                        <ShoppingBag size={16} strokeWidth={1.5} />
                        {cartCount > 0 && (
                            <span className="navbar-cart-badge">{cartCount}</span>
                        )}
                    </Link>
                    <Link to="/account" aria-label="Profile">
                        <User size={16} strokeWidth={1.5} />
                    </Link>
                </div>
            </div>
        </nav>
    )
}
