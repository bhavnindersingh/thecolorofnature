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
    shipping_address: Record<string, string> | null
    shipping_address_id: string | null
    payment_intent_id: string | null
    odoo_order_id: number | null
    tracking_number: string | null
    carrier: string | null
    estimated_delivery: string | null
    odoo_picking_name: string | null
    created_at: string
    updated_at: string
    // Joined fields
    order_items?: OrderItem[]
    shipping_address_data?: Address
    order_status_history?: OrderStatusHistory[]
    return_requests?: ReturnRequest[]
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

export interface OrderStatusHistory {
    id: number
    order_id: string
    status: OrderStatus
    note: string | null
    changed_by: string
    created_at: string
}

export type ReturnStatus = 'pending' | 'approved' | 'item_shipped' | 'item_received' | 'rejected' | 'completed'

export interface ReturnRequest {
    id: string
    order_id: string
    user_id: string
    reason: string
    status: ReturnStatus
    odoo_return_id: number | null
    admin_note: string | null
    return_instructions: string | null
    created_at: string
    updated_at: string
    // Joined
    order?: Order
}

// =============================================================================
// PRODUCTS
// =============================================================================

/** Fetch all products (tagged for online shop) — out-of-stock products still show with a badge */
export const getProducts = () =>
    supabase
        .from('products')
        .select('*, product_images(*), product_variants(*)')
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

/** Fetch the current user's orders with items, products, and status history */
export const getMyOrders = () =>
    supabase
        .from('orders')
        .select('*, order_items(*, product:products(*, product_images(*))), order_status_history(*), return_requests(*)')
        .order('created_at', { ascending: false })

/** Fetch a single order with full details */
export const getOrderById = (orderId: string) =>
    supabase
        .from('orders')
        .select('*, order_items(*, product:products(*, product_images(*))), order_status_history(*), return_requests(*)')
        .eq('id', orderId)
        .single()

/** Fetch order status timeline */
export const getOrderTimeline = (orderId: string) =>
    supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true })

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

/** Set an address as default — atomic single UPDATE via DB function */
export const setDefaultAddress = async (addressId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    return supabase.rpc('set_default_address', { p_address_id: addressId })
}

/** Delete an address (user_id guard as defence-in-depth alongside RLS) */
export const deleteAddress = async (addressId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    return supabase.from('addresses').delete().eq('id', addressId).eq('user_id', user.id)
}

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
export const removeFromWishlist = async (productId: number) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    return supabase.from('wishlist_items').delete().eq('product_id', productId).eq('user_id', user.id)
}

// =============================================================================
// RETURNS
// =============================================================================

/** Fetch the current user's return requests */
export const getMyReturns = () =>
    supabase
        .from('return_requests')
        .select('*, order:orders(id, status, total_amount, created_at, odoo_order_id)')
        .order('created_at', { ascending: false })

/** Create a return request */
export const createReturnRequest = async (orderId: string, reason: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    return supabase
        .from('return_requests')
        .insert({ order_id: orderId, user_id: user.id, reason })
        .select()
        .single()
}

// =============================================================================
// PROFILE
// =============================================================================

/** Fetch the current user's profile */
export const getMyProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    return supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
}

/** Update the current user's profile. Keeps full_name in sync with first/last name. */
export const updateMyProfile = async (updates: { first_name?: string; last_name?: string; phone?: string }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const payload: Record<string, string | null> = { ...updates }
    if ('first_name' in updates || 'last_name' in updates) {
        payload.full_name = [updates.first_name ?? '', updates.last_name ?? ''].filter(Boolean).join(' ') || null
    }
    return supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id)
        .select()
        .single()
}

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
export const syncOrderToOdoo = (
    orderId: string,
    customerEmail: string,
    customerName: string,
    items: Array<{ odoo_variant_id: number; quantity: number; price: number }>,
) =>
    supabase.functions.invoke('sync-to-odoo', {
        body: {
            action: 'sync_order',
            payload: {
                supabase_order_id: orderId,
                customer_email: customerEmail,
                customer_name: customerName,
                items,
            },
        },
    })

/** Cancel an order in Odoo (before shipment) */
export const cancelOrderInOdoo = (odooOrderId: number) =>
    supabase.functions.invoke('sync-to-odoo', {
        body: {
            action: 'cancel_order',
            payload: { odoo_order_id: odooOrderId },
        },
    })

/** Request a return for a shipped order in Odoo */
export const returnOrderInOdoo = (odooOrderId: number) =>
    supabase.functions.invoke('sync-to-odoo', {
        body: {
            action: 'return_order',
            payload: { odoo_order_id: odooOrderId },
        },
    })

/** Trigger product sync from Odoo → Supabase */
export const triggerProductSync = () =>
    supabase.functions.invoke('sync-products', {
        body: {},
    })

// =============================================================================
// ORDER CONFIRMATION (dummy payment flow)
// =============================================================================

/** Confirm order payment (dummy) and sync to Odoo */
export const confirmOrderPayment = (orderId: string) =>
    supabase.functions.invoke('confirm-order', {
        body: { order_id: orderId },
    })

// =============================================================================
// RETURN ACTIONS
// =============================================================================

/** Mark a return request as "item shipped" (customer action) */
export const markReturnShipped = async (returnId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    return supabase
        .from('return_requests')
        .update({ status: 'item_shipped', updated_at: new Date().toISOString() })
        .eq('id', returnId)
        .eq('user_id', user.id)
        .eq('status', 'approved')
}
