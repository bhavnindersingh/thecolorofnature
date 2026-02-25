import { useQuery } from '@tanstack/react-query'
import { getProducts, type Product } from '../lib/supabase'

function ProductCard({ product }: { product: Product }) {
    const addToCart = () => {
        const cart: Product[] = JSON.parse(localStorage.getItem('cart') || '[]')
        cart.push(product)
        localStorage.setItem('cart', JSON.stringify(cart))
        window.dispatchEvent(new Event('cart-updated'))
    }

    return (
        <div className="product-card">
            <div className="product-card-image-wrap">
                {product.image_url
                    ? <img src={product.image_url} alt={product.name} className="product-card-image" />
                    : <div className="product-card-placeholder">🌿</div>
                }
                <div className="product-card-overlay">
                    <button className="product-card-add-btn" onClick={addToCart}>
                        + Add to Cart
                    </button>
                </div>
            </div>
            <div className="product-card-body">
                {product.category && <div className="product-card-category">{product.category}</div>}
                <div className="product-card-name">{product.name}</div>
                {product.description && <div className="product-card-desc">{product.description}</div>}
                <div className="product-card-footer">
                    <span className="product-card-price">₹{product.price.toFixed(2)}</span>
                </div>
            </div>
        </div>
    )
}

export default function Shop() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['products'],
        queryFn: async () => {
            const { data, error } = await getProducts()
            if (error) throw error
            return data as Product[]
        },
    })

    return (
        <main style={{ paddingTop: 'calc(72px + 4rem)', paddingBottom: '6rem' }}>
            <div className="container">
                <div className="section-header">
                    <span className="section-tag">All Products</span>
                    <h1 className="section-title"><em>Nature&apos;s Finest</em></h1>
                    <p className="section-desc">
                        100% natural, ethically sourced products for your everyday life.
                    </p>
                </div>

                {isLoading && <div className="spinner" />}

                {error && (
                    <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--ink-muted)' }}>
                        <p style={{ marginBottom: '0.5rem' }}>Could not load products.</p>
                        <p style={{ fontSize: '0.82rem' }}>{(error as Error).message}</p>
                    </div>
                )}

                {!isLoading && !error && data?.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--ink-muted)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1.5rem', opacity: 0.3 }}>🌱</div>
                        <p style={{ fontSize: '0.9rem' }}>No products yet. They will appear here once synced from Odoo.</p>
                    </div>
                )}

                {data && data.length > 0 && (
                    <div className="product-grid">
                        {data.map((p) => <ProductCard key={p.id} product={p} />)}
                    </div>
                )}
            </div>
        </main>
    )
}
