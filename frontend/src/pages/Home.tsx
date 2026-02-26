import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getProducts, type Product } from '../lib/supabase'

const FEATURES = [
    { num: '01', title: 'Natural Fibres', desc: 'Linen, silk, cashmere, and merino — pure materials that breathe and age beautifully.' },
    { num: '02', title: 'Slow Fashion', desc: 'Every piece is made in small batches. Quality over quantity, always.' },
    { num: '03', title: 'Ethical Craft', desc: 'Produced in certified ateliers that pay fair wages and honour the craft.' },
    { num: '04', title: 'Eco Packaging', desc: 'Biodegradable tissue, recycled boxes — delivered with care for the earth.' },
]

const EDITORIAL = [
    { label: 'New Season', headline: 'The Linen Edit', sub: 'Pure, breathable, effortless.', img: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=900&auto=format&fit=crop', link: '/shop' },
    { label: 'Knitwear', headline: 'Woven Warmth', sub: 'Merino & cashmere for cooler days.', img: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=900&auto=format&fit=crop', link: '/shop' },
    { label: 'Outerwear', headline: 'The Trench', sub: 'A silhouette born from tradition.', img: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=900&auto=format&fit=crop', link: '/shop' },
]

function FeaturedCard({ product }: { product: Product }) {
    const img = product.product_images?.find(i => i.is_primary)?.image_url ?? product.image_url
    const [adding, setAdding] = useState(false)

    const addToCart = () => {
        setAdding(true)
        const cart: Product[] = JSON.parse(localStorage.getItem('cart') || '[]')
        cart.push(product)
        localStorage.setItem('cart', JSON.stringify(cart))
        window.dispatchEvent(new Event('cart-updated'))
        setTimeout(() => setAdding(false), 800)
    }

    return (
        <div className="product-card">
            <Link to={`/product/${product.id}`} className="product-card-link">
                <div className="product-card-image-wrap">
                    {img
                        ? <img src={img} alt={product.name} className="product-card-image" />
                        : <div className="product-card-placeholder">🌿</div>
                    }
                </div>
            </Link>
            <div className="product-card-body">
                {product.category && <div className="product-card-category">{product.category}</div>}
                <Link to={`/product/${product.id}`}><div className="product-card-name">{product.name}</div></Link>
                <div className="product-card-footer">
                    <span className="product-card-price">₹{product.price.toLocaleString('en-IN')}</span>
                </div>
                <button
                    className="product-card-add-btn"
                    style={{ marginTop: '0.75rem', width: '100%', display: 'block' }}
                    onClick={addToCart}
                >
                    {adding ? '✓ Added' : '+ Add to Cart'}
                </button>
            </div>
        </div>
    )
}

export default function Home() {
    const { data: featuredProducts } = useQuery({
        queryKey: ['products'],
        queryFn: async () => {
            const { data, error } = await getProducts()
            if (error) throw error
            return data as Product[]
        },
    })

    const featured = featuredProducts?.slice(0, 4) ?? []
    const hasFeatured = featured.length > 0

    return (
        <main>
            {/* ── Hero ─────────────────────────────────────────────────── */}
            <section className="hero">
                <div className="hero-content">
                    <span className="hero-eyebrow">Pure · Natural · Powerful</span>
                    <h1 className="hero-title">
                        Beauty born from<br /><em>the Colors of Nature</em>
                    </h1>
                    <p className="hero-subtitle">
                        Curated clothing in natural fibres — linen, silk, cashmere, merino.
                        Designed for women who choose quality, simplicity, and the earth.
                    </p>
                    <div className="hero-cta">
                        <Link to="/shop" className="btn btn-primary">
                            Shop Now <ArrowRight size={14} strokeWidth={1.5} />
                        </Link>
                        <Link to="/shop" className="btn btn-ghost">
                            Explore Collection
                        </Link>
                    </div>
                </div>

                <div className="hero-image-col">
                    <img
                        src="https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=1200&auto=format&fit=crop"
                        alt="Woman in flowing ivory linen dress"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                </div>
            </section>

            {/* ── Features Strip ────────────────────────────────────────── */}
            <div className="features-strip">
                {FEATURES.map(f => (
                    <div className="feature-item" key={f.num}>
                        <div className="feature-num">{f.num}</div>
                        <div className="feature-title">{f.title}</div>
                        <div className="feature-desc">{f.desc}</div>
                    </div>
                ))}
            </div>

            {/* ── Editorial Triptych ─────────────────────────────────────── */}
            <section className="section">
                <div className="container">
                    <div className="section-header">
                        <span className="section-tag">Editorials</span>
                        <h2 className="section-title"><em>Stories of Style</em></h2>
                    </div>
                    <div className="editorial-grid">
                        {EDITORIAL.map(e => (
                            <Link to={e.link} key={e.headline} className="editorial-card">
                                <div className="editorial-card-image-wrap">
                                    <img src={e.img} alt={e.headline} />
                                </div>
                                <div className="editorial-card-body">
                                    <span className="editorial-tag">{e.label}</span>
                                    <div className="editorial-headline">{e.headline}</div>
                                    <p className="editorial-sub">{e.sub}</p>
                                    <span className="editorial-cta">
                                        Shop Now <ArrowRight size={12} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle' }} />
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Featured Products ──────────────────────────────────────── */}
            {hasFeatured && (
                <section className="section" style={{ paddingTop: '2rem' }}>
                    <div className="container">
                        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div>
                                <span className="section-tag">New In</span>
                                <h2 className="section-title"><em>The Edit</em></h2>
                            </div>
                            <Link to="/shop" className="btn btn-ghost" style={{ marginBottom: '1rem' }}>
                                View All <ArrowRight size={13} strokeWidth={1.5} />
                            </Link>
                        </div>
                        <div className="product-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                            {featured.map(p => <FeaturedCard key={p.id} product={p} />)}
                        </div>
                    </div>
                </section>
            )}

            {/* ── CTA Banner ────────────────────────────────────────────── */}
            <div className="cta-banner">
                <div className="container">
                    <div className="section-header centered">
                        <span className="section-tag">Full Collection</span>
                        <h2 className="section-title"><em>Dressed by Nature</em></h2>
                        <p className="section-desc" style={{ color: 'rgba(250,248,245,0.6)', marginBottom: '2.5rem' }}>
                            From dawn to dusk — clothing that honours both the wearer and the world.
                        </p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <Link to="/shop" className="btn-light">
                            Explore the Collection <ArrowRight size={14} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle' }} />
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    )
}
