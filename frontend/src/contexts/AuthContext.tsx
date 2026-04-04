import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, mergeLocalCartToServer } from '../lib/supabase'
import type { Product } from '../lib/supabase'

interface AuthContextValue {
    user: User | null
    loading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('[Auth] State change event:', event, ' User:', session?.user?.email ?? 'none')
            setUser(session?.user ?? null)
            setLoading(false)

            // On login: merge any anonymous localStorage cart into the server cart
            if (event === 'SIGNED_IN') {
                try {
                    const raw = localStorage.getItem('cart')
                    if (raw) {
                        const localProducts: Product[] = JSON.parse(raw)
                        if (localProducts.length > 0) {
                            mergeLocalCartToServer(localProducts)
                                .then(() => {
                                    localStorage.removeItem('cart')
                                    window.dispatchEvent(new Event('cart-updated'))
                                })
                                .catch(console.error)
                        }
                    }
                } catch {
                    // Non-critical — localStorage parse failure, skip merge
                }
            }
        })
        return () => subscription.unsubscribe()
    }, [])

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {children}
        </AuthContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
    return ctx
}
