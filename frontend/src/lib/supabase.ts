import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key'

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    console.warn('⚠️  Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — set these in Netlify Environment Variables. Supabase features will not work.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// =============================================================================
// TYPES
// =============================================================================

export interface Profile {
    id: string
    full_name: string | null
    first_name: string | null
    last_name: string | null
    phone: string | null
    avatar_url: string | null
    odoo_partner_id: number | null
    created_at: string
}

export interface Address {
    id: string
    user_id: string
    label: string | null
    first_name: string
    last_name: string
    address_line_1: string
    address_line_2: string | null
    city: string
    state: string | null
    postal_code: string
    country: string
    phone: string | null
    is_default: boolean
    created_at: string
}

export interface Product {
    id: number
    odoo_product_id: number
    name: string
    description: string | null
    price: number
    image_url: string | null
    category: string | null
    in_stock: boolean
    created_at: string
    updated_at: string
    // Joined fields (when queried with select)
    product_variants?: ProductVariant[]
    product_images?: ProductImage[]
}

export interface ProductVariant {
    id: number
    product_id: number
    sku: string | null
    size: string | null
    color: string | null
    color_hex: string | null
    stock_quantity: number
    price_adjustment: number
    odoo_variant_id: number | null
    created_at: string
}

export interface ProductImage {
    id: number
    product_id: number
    variant_id: number | null
    image_url: string
    alt_text: string | null
    display_order: number
    is_primary: boolean
    created_at: string
}

export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

export interface Order {
    id: string
    user_id: string
    status: OrderStatus
    total_amount: number
    shipping_address: Record<string, string> | null   // Legacy JSONB
    shipping_address_id: string | null                // Structured FK
    payment_intent_id: string | null
    odoo_order_id: number | null
    created_at: string
    updated_at: string
    // Joined fields
    order_items?: OrderItem[]
    shipping_address_data?: Address
}

export interface OrderItem {
    id: number
    order_id: string
    product_id: number
    quantity: number
    unit_price: number
    created_at: string
    // Joined fields
    product?: Product
}

export interface WishlistItem {
    id: number
    user_id: string
    product_id: number
    created_at: string
    // Joined
    product?: Product
}

export interface ProductReview {
    id: number
    product_id: number
    user_id: string
    rating: 1 | 2 | 3 | 4 | 5
    title: string | null
    body: string | null
    is_approved: boolean
    created_at: string
    // Joined
    profile?: Pick<Profile, 'full_name' | 'first_name' | 'last_name' | 'avatar_url'>
}

// =============================================================================
// PRODUCTS
// =============================================================================

/** Fetch all in-stock products */
export const getProducts = () =>
    supabase
        .from('products')
        .select('*, product_images(*), product_variants(*)')
        .eq('in_stock', true)
        .order('name')

/** Fetch a single product by ID with all variants & images */
export const getProductById = (id: number) =>
    supabase
        .from('products')
        .select('*, product_images(*), product_variants(*)')
        .eq('id', id)
        .single()

/** Fetch products by category */
export const getProductsByCategory = (category: string) =>
    supabase
        .from('products')
        .select('*, product_images(*), product_variants(*)')
        .eq('category', category)
        .eq('in_stock', true)

// =============================================================================
// ORDERS
// =============================================================================

/** Fetch the current user's orders with items and products */
export const getMyOrders = () =>
    supabase
        .from('orders')
        .select('*, order_items(*, product:products(*))')
        .order('created_at', { ascending: false })

/** Create a new order, then insert its items */
export const createOrder = async (
    items: Array<{ product_id: number; quantity: number; unit_price: number }>,
    shippingAddress: Record<string, string>,
    totalAmount: number,
    shippingAddressId?: string,
) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: order, error } = await supabase
        .from('orders')
        .insert({
            user_id: user.id,
            total_amount: totalAmount,
            shipping_address: shippingAddress,
            shipping_address_id: shippingAddressId ?? null,
        })
        .select()
        .single()

    if (error) throw error

    const { error: itemsError } = await supabase
        .from('order_items')
        .insert(items.map((item) => ({ ...item, order_id: order.id })))

    if (itemsError) throw itemsError
    return order
}

// =============================================================================
// ADDRESSES
// =============================================================================

/** Fetch the current user's saved addresses */
export const getMyAddresses = () =>
    supabase
        .from('addresses')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

/** Add a new address for the current user */
export const addAddress = async (address: Omit<Address, 'id' | 'user_id' | 'created_at'>) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    return supabase.from('addresses').insert({ ...address, user_id: user.id }).select().single()
}

/** Set an address as default (unsets all others first) */
export const setDefaultAddress = async (addressId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    // Unset all
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id)
    // Set chosen one
    return supabase.from('addresses').update({ is_default: true }).eq('id', addressId)
}

/** Delete an address */
export const deleteAddress = (addressId: string) =>
    supabase.from('addresses').delete().eq('id', addressId)

// =============================================================================
// WISHLIST
// =============================================================================

/** Fetch the current user's wishlist */
export const getMyWishlist = () =>
    supabase
        .from('wishlist_items')
        .select('*, product:products(*, product_images(*))')
        .order('created_at', { ascending: false })

/** Add a product to the wishlist */
export const addToWishlist = async (productId: number) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    return supabase.from('wishlist_items').upsert({ user_id: user.id, product_id: productId })
}

/** Remove a product from the wishlist */
export const removeFromWishlist = (productId: number) =>
    supabase.from('wishlist_items').delete().eq('product_id', productId)

// =============================================================================
// REVIEWS
// =============================================================================

/** Fetch approved reviews for a product */
export const getProductReviews = (productId: number) =>
    supabase
        .from('product_reviews')
        .select('*, profile:profiles(full_name, first_name, last_name, avatar_url)')
        .eq('product_id', productId)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })

/** Submit a review */
export const submitReview = async (productId: number, rating: number, title: string, body: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    return supabase
        .from('product_reviews')
        .upsert({ product_id: productId, user_id: user.id, rating, title, body })
}

// =============================================================================
// ODOO SYNC
// =============================================================================

/** Trigger the Edge Function to sync an order to Odoo */
export const syncOrderToOdoo = (orderId: string, customerEmail: string, items: unknown[]) =>
    supabase.functions.invoke('sync-to-odoo', {
        body: {
            action: 'sync_order',
            payload: { supabase_order_id: orderId, customer_email: customerEmail, items },
        },
    })
