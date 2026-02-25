import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { getProducts, type Product } from '../lib/supabase'

function ProductCard({ product }: { product: Product }) {
    const addToCart = () => {
        const cart: Product[] = JSON.parse(localStorage.getItem('cart') || '[]')
        cart.push(product)
        localStorage.setItem('cart', JSON.stringify(cart))
        window.dispatchEvent(new Event('cart-updated'))
        alert(`${product.name} added to cart!`)
    }

    return (
        <div className="product-card">
            {product.image_url
                ? <img className="product-card-image" src={product.image_url} alt={product.name} />
                : <div className="product-card-image" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>🌿</div>
            }
            <div className="product-card-body">
                {product.category && <div className="product-card-category">{product.category}</div>}
                <div className="product-card-name">{product.name}</div>
                {product.description && <div className="product-card-desc">{product.description}</div>}
                <div className="product-card-footer">
                    <span className="product-card-price">₹{product.price.toFixed(2)}</span>
                    <button className="product-card-add" onClick={addToCart} title="Add to cart">
                        <Plus size={16} />
                    </button>
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
        <main style={{ paddingTop: 'calc(68px + 3rem)', paddingBottom: '4rem' }}>
            <div className="container">
                <div className="section-header">
                    <span className="section-tag">All Products</span>
                    <h1 className="section-title">Nature&apos;s Finest</h1>
                    <p className="section-desc">100% natural, ethically sourced products for your everyday life.</p>
                </div>

                {isLoading && <div className="spinner" />}

                {error && (
                    <div style={{ textAlign: 'center', padding: '4rem 0', color: '#f87171' }}>
                        <p>⚠️ Could not load products. Please check your Supabase connection.</p>
                        <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--color-text-muted)' }}>
                            {(error as Error).message}
                        </p>
                    </div>
                )}

                {!isLoading && !error && data?.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--color-text-muted)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌱</div>
                        <p>No products yet. They will appear here once synced from Odoo.</p>
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
