import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Heart } from 'lucide-react'
import { getProducts, addToWishlist, type Product } from '../lib/supabase'

const CATEGORIES = ['All', 'Dresses', 'Blazers', 'Knitwear', 'Tops', 'Trousers', 'Skirts', 'Sets', 'Outerwear', 'Denim']

function ProductCard({ product }: { product: Product }) {
    const [wished, setWished] = useState(false)
    const [adding, setAdding] = useState(false)

    const primaryImage = product.product_images?.find(i => i.is_primary) ?? product.product_images?.[0]
    const secondImage = product.product_images?.[1]
    const imageSrc = primaryImage?.image_url ?? product.image_url

    const addToCart = () => {
        setAdding(true)
        const cart: Product[] = JSON.parse(localStorage.getItem('cart') || '[]')
        cart.push(product)
        localStorage.setItem('cart', JSON.stringify(cart))
        window.dispatchEvent(new Event('cart-updated'))
        setTimeout(() => setAdding(false), 800)
    }

    const toggleWish = async (e: React.MouseEvent) => {
        e.stopPropagation()
        setWished(w => !w)
        try { await addToWishlist(product.id) } catch { /* not authenticated */ }
    }

    return (
        <div className="product-card">
            <Link to={`/product/${product.id}`} className="product-card-link">
                <div className="product-card-image-wrap">
                    {imageSrc ? (
                        <>
                            <img src={imageSrc} alt={product.name} className="product-card-image product-card-image--primary" />
                            {secondImage && (
                                <img src={secondImage.image_url} alt={product.name} className="product-card-image product-card-image--hover" />
                            )}
                        </>
                    ) : (
                        <div className="product-card-placeholder">🌿</div>
                    )}

                    {/* Wishlist */}
                    <button className={`product-card-wish${wished ? ' wished' : ''}`} onClick={toggleWish} aria-label="Add to wishlist">
                        <Heart size={15} strokeWidth={1.5} fill={wished ? 'currentColor' : 'none'} />
                    </button>
                </div>
            </Link>

            <div className="product-card-body">
                <Link to={`/product/${product.id}`} className="product-card-link">
                    {product.category && <div className="product-card-category">{product.category}</div>}
                    <div className="product-card-name">{product.name}</div>
                </Link>

                {/* Colour swatches */}
                {product.product_variants && product.product_variants.length > 0 && (
                    <div className="product-card-swatches">
                        {[...new Map(
                            product.product_variants
                                .filter(v => v.color_hex)
                                .map(v => [v.color, v])
                        ).values()].slice(0, 5).map(v => (
                            <span
                                key={v.color}
                                className="product-card-swatch"
                                style={{ background: v.color_hex! }}
                                title={v.color ?? ''}
                            />
                        ))}
                    </div>
                )}

                <div className="product-card-footer">
                    <Link to={`/product/${product.id}`} className="product-card-price" style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', color: 'var(--ink)' }}>
                        ₹{product.price.toLocaleString('en-IN')}
                    </Link>
                    {product.product_variants && product.product_variants.length > 0 && (
                        <span className="product-card-sizes">
                            {[...new Set(product.product_variants.filter(v => v.stock_quantity > 0).map(v => v.size))].join(' · ')}
                        </span>
                    )}
                </div>
                <button className="product-card-add-btn" style={{ marginTop: '0.75rem', width: '100%', display: 'block' }} onClick={addToCart}>
                    {adding ? '✓ Added' : '+ Add to Cart'}
                </button>
            </div>
        </div>
    )
}

export default function Shop() {
    const [activeCategory, setActiveCategory] = useState('All')
    const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc'>('default')

    const { data, isLoading, error } = useQuery({
        queryKey: ['products'],
        queryFn: async () => {
            const { data, error } = await getProducts()
            if (error) throw error
            return data as Product[]
        },
    })

    const filtered = useMemo(() => {
        if (!data) return []
        let list = activeCategory === 'All' ? data : data.filter(p => p.category === activeCategory)
        if (sortBy === 'price-asc') list = [...list].sort((a, b) => a.price - b.price)
        if (sortBy === 'price-desc') list = [...list].sort((a, b) => b.price - a.price)
        return list
    }, [data, activeCategory, sortBy])

    const availableCategories = useMemo(() => {
        if (!data) return CATEGORIES
        const cats = new Set(data.map(p => p.category).filter(Boolean))
        return CATEGORIES.filter(c => c === 'All' || cats.has(c))
    }, [data])

    return (
        <main style={{ paddingTop: 'calc(72px + 3rem)', paddingBottom: '7rem' }}>
            <div className="container">

                {/* ── Page Header ─────────────────────────────────────────── */}
                <div className="shop-page-header">
                    <div className="section-header">
                        <span className="section-tag">The Collection</span>
                        <h1 className="section-title"><em>Nature's Finest</em></h1>
                        <p className="section-desc">
                            Curated pieces crafted from natural fibres — thoughtfully designed, effortlessly worn.
                        </p>
                    </div>
                </div>

                {/* ── Filters Bar ─────────────────────────────────────────── */}
                <div className="shop-filters-bar">
                    <div className="shop-category-tabs">
                        {availableCategories.map(cat => (
                            <button
                                key={cat}
                                className={`shop-cat-tab${activeCategory === cat ? ' active' : ''}`}
                                onClick={() => setActiveCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className="shop-sort">
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as typeof sortBy)}
                            className="shop-sort-select"
                        >
                            <option value="default">Sort: Featured</option>
                            <option value="price-asc">Price: Low to High</option>
                            <option value="price-desc">Price: High to Low</option>
                        </select>
                    </div>
                </div>

                {/* ── Count ───────────────────────────────────────────────── */}
                {!isLoading && !error && data && (
                    <div className="shop-count">
                        {filtered.length} {filtered.length === 1 ? 'piece' : 'pieces'}
                    </div>
                )}

                {/* ── States ──────────────────────────────────────────────── */}
                {isLoading && (
                    <div className="shop-skeleton-grid">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="product-card-skeleton">
                                <div className="skeleton-img" />
                                <div className="skeleton-body">
                                    <div className="skeleton-line short" />
                                    <div className="skeleton-line" />
                                    <div className="skeleton-line mid" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {error && (
                    <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--ink-muted)' }}>
                        <p>Could not load products. Please try again.</p>
                        <p style={{ fontSize: '0.78rem', marginTop: '0.5rem' }}>{(error as Error).message}</p>
                    </div>
                )}

                {!isLoading && !error && filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--ink-muted)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1.5rem', opacity: 0.25 }}>🌱</div>
                        <p style={{ fontSize: '0.9rem' }}>
                            {data?.length === 0
                                ? 'No products yet — they will appear once synced from Odoo.'
                                : `No products in "${activeCategory}".`}
                        </p>
                    </div>
                )}

                {/* ── Product Grid ─────────────────────────────────────────── */}
                {filtered.length > 0 && (
                    <div className="product-grid">
                        {filtered.map(p => <ProductCard key={p.id} product={p} />)}
                    </div>
                )}
            </div>
        </main>
    )
}
