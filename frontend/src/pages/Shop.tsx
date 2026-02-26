import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Heart, ShoppingBag } from 'lucide-react'
import { getProducts, addToWishlist, type Product } from '../lib/supabase'

const CATEGORIES = ['All', 'Dresses', 'Blazers', 'Knitwear', 'Tops', 'Trousers', 'Skirts', 'Sets', 'Outerwear', 'Denim']

function ProductCard({ product }: { product: Product }) {
    const [wished, setWished] = useState(false)
    const [adding, setAdding] = useState(false)

    const primaryImage = product.product_images?.find(i => i.is_primary) ?? product.product_images?.[0]
    const secondImage = product.product_images?.[1]
    const imageSrc = primaryImage?.image_url ?? product.image_url

    const addToCart = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setAdding(true)
        const cart: Product[] = JSON.parse(localStorage.getItem('cart') || '[]')
        cart.push(product)
        localStorage.setItem('cart', JSON.stringify(cart))
        window.dispatchEvent(new Event('cart-updated'))
        setTimeout(() => setAdding(false), 1200)
    }

    const toggleWish = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setWished(w => !w)
        try { await addToWishlist(product.id) } catch { /* not authenticated */ }
    }

    const sizes = product.product_variants
        ? [...new Set(product.product_variants.filter(v => v.stock_quantity > 0).map(v => v.size))].filter(Boolean)
        : []

    const colorSwatches = product.product_variants
        ? [...new Map(
            product.product_variants.filter(v => v.color_hex).map(v => [v.color, v])
        ).values()].slice(0, 4)
        : []

    return (
        <Link to={`/product/${product.id}`} className="product-card">
            {/* ── Image ────────────────────────────────────────────────── */}
            <div className="product-card-image-wrap">
                {imageSrc ? (
                    <>
                        <img
                            src={imageSrc}
                            alt={product.name}
                            className={`product-card-image${secondImage ? ' product-card-image--primary' : ''}`}
                        />
                        {secondImage && (
                            <img
                                src={secondImage.image_url}
                                alt={product.name}
                                className="product-card-image product-card-image--hover"
                            />
                        )}
                    </>
                ) : (
                    <div className="product-card-placeholder">🌿</div>
                )}

                {/* Wishlist pill */}
                <button
                    className={`product-card-wish${wished ? ' wished' : ''}`}
                    onClick={toggleWish}
                    aria-label="Wishlist"
                >
                    <Heart size={14} strokeWidth={1.5} fill={wished ? 'currentColor' : 'none'} />
                </button>

                {/* Add-to-cart overlay — appears on hover */}
                <div className="product-card-overlay">
                    <button className="product-card-add-btn" onClick={addToCart}>
                        {adding
                            ? <><span>✓</span> Added</>
                            : <><ShoppingBag size={13} strokeWidth={1.5} /> Add to Cart</>
                        }
                    </button>
                </div>
            </div>

            {/* ── Info ─────────────────────────────────────────────────── */}
            <div className="product-card-body">
                <div className="product-card-meta-row">
                    {product.category && <span className="product-card-category">{product.category}</span>}
                    {colorSwatches.length > 0 && (
                        <span className="product-card-swatches">
                            {colorSwatches.map(v => (
                                <span
                                    key={v.color}
                                    className="product-card-swatch"
                                    style={{ background: v.color_hex! }}
                                    title={v.color ?? ''}
                                />
                            ))}
                        </span>
                    )}
                </div>

                <div className="product-card-name">{product.name}</div>

                <div className="product-card-footer">
                    <span className="product-card-price">₹{product.price.toLocaleString('en-IN')}</span>
                    {sizes.length > 0 && (
                        <span className="product-card-sizes">{sizes.join(' · ')}</span>
                    )}
                </div>
            </div>
        </Link>
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
        <main className="shop-page">
            <div className="container">

                {/* ── Page Hero ────────────────────────────────────────── */}
                <div className="shop-hero">
                    <div className="shop-hero-left">
                        <span className="section-tag">The Collection</span>
                        <h1 className="shop-hero-title"><em>Nature's Finest</em></h1>
                    </div>
                    <p className="shop-hero-desc">
                        Curated pieces in linen, silk, cashmere and merino —<br />
                        thoughtfully made, effortlessly worn.
                    </p>
                </div>

                {/* ── Filters + Sort ───────────────────────────────────── */}
                <div className="shop-toolbar">
                    <nav className="shop-category-tabs" aria-label="Product categories">
                        {availableCategories.map(cat => (
                            <button
                                key={cat}
                                className={`shop-cat-tab${activeCategory === cat ? ' active' : ''}`}
                                onClick={() => setActiveCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </nav>

                    <div className="shop-toolbar-right">
                        {!isLoading && !error && data && (
                            <span className="shop-count">
                                {filtered.length} {filtered.length === 1 ? 'piece' : 'pieces'}
                            </span>
                        )}
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as typeof sortBy)}
                            className="shop-sort-select"
                        >
                            <option value="default">Featured</option>
                            <option value="price-asc">Price ↑</option>
                            <option value="price-desc">Price ↓</option>
                        </select>
                    </div>
                </div>

                {/* ── Loading skeletons ────────────────────────────────── */}
                {isLoading && (
                    <div className="product-grid">
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

                {/* ── Error ───────────────────────────────────────────── */}
                {error && (
                    <div className="shop-empty">
                        <p>Could not load products.</p>
                        <p style={{ fontSize: '0.78rem', marginTop: '0.4rem' }}>{(error as Error).message}</p>
                    </div>
                )}

                {/* ── Empty ───────────────────────────────────────────── */}
                {!isLoading && !error && filtered.length === 0 && (
                    <div className="shop-empty">
                        <div className="shop-empty-icon">🌱</div>
                        <p>{data?.length === 0
                            ? 'No products yet — they will appear once synced from Odoo.'
                            : `Nothing in "${activeCategory}" yet.`}
                        </p>
                    </div>
                )}

                {/* ── Product Grid ─────────────────────────────────────── */}
                {filtered.length > 0 && (
                    <div className="product-grid">
                        {filtered.map(p => <ProductCard key={p.id} product={p} />)}
                    </div>
                )}
            </div>
        </main>
    )
}
