import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️  Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local — Supabase features will not work.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Profile {
    id: string
    full_name: string
    phone?: string
    avatar_url?: string
    odoo_partner_id?: number
    created_at: string
}

export interface Product {
    id: number
    odoo_product_id: number
    name: string
    description?: string
    price: number
    image_url?: string
    category?: string
    in_stock: boolean
}

export interface Order {
    id: string
    user_id: string
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
    total_amount: number
    shipping_address: Record<string, string>
    odoo_order_id?: number
    created_at: string
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

/** Fetch all in-stock products from Supabase (fast cache of Odoo catalog) */
export const getProducts = () =>
    supabase.from('products').select('*').eq('in_stock', true).order('name')

/** Fetch products by category */
export const getProductsByCategory = (category: string) =>
    supabase.from('products').select('*').eq('category', category).eq('in_stock', true)

/** Fetch the signed-in user's orders */
export const getMyOrders = () =>
    supabase.from('orders').select('*, order_items(*, products(*))').order('created_at', { ascending: false })

/** Create an order in Supabase — the Edge Function auto-syncs it to Odoo */
export const createOrder = async (
    items: Array<{ product_id: number; quantity: number; unit_price: number }>,
    shippingAddress: Record<string, string>,
    totalAmount: number
) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: order, error } = await supabase
        .from('orders')
        .insert({ user_id: user.id, total_amount: totalAmount, shipping_address: shippingAddress })
        .select()
        .single()

    if (error) throw error

    const { error: itemsError } = await supabase.from('order_items').insert(
        items.map((item) => ({ ...item, order_id: order.id }))
    )

    if (itemsError) throw itemsError
    return order
}

/** Trigger the Edge Function to sync an order to Odoo */
export const syncOrderToOdoo = (orderId: string, customerEmail: string, items: unknown[]) =>
    supabase.functions.invoke('sync-to-odoo', {
        body: {
            action: 'sync_order',
            payload: { supabase_order_id: orderId, customer_email: customerEmail, items },
        },
    })
