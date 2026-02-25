import { Link } from 'react-router-dom'
import { ArrowRight, Leaf } from 'lucide-react'

const features = [
    { icon: '🌱', title: '100% Natural', desc: 'Every product is sourced from nature, free from synthetic chemicals.' },
    { icon: '🚚', title: 'Free Delivery', desc: 'Free shipping on all orders above ₹999 across India.' },
    { icon: '🛡️', title: 'Quality Assured', desc: 'Rigorously tested and certified for purity and potency.' },
    { icon: '♻️', title: 'Eco Packaging', desc: 'Biodegradable packaging that gives back to the earth.' },
]

export default function Home() {
    return (
        <main>
            {/* ── Hero ────────────────────────────────────────────── */}
            <section className="hero">
                <div className="container hero-content">
                    <span className="hero-eyebrow">
                        <Leaf size={12} /> Pure. Natural. Powerful.
                    </span>
                    <h1 className="hero-title">
                        Beauty born from<br /><em>the Colors of Nature</em>
                    </h1>
                    <p className="hero-subtitle">
                        Discover our curated collection of 100% natural skincare, wellness and lifestyle
                        products — crafted with love, sourced from the earth.
                    </p>
                    <div className="hero-cta">
                        <Link to="/shop" className="btn btn-primary">
                            Shop Now <ArrowRight size={16} />
                        </Link>
                        <Link to="/about" className="btn btn-ghost">
                            Our Story
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── Features Strip ──────────────────────────────────── */}
            <section className="section" style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                <div className="container">
                    <div className="features-strip">
                        {features.map((f) => (
                            <div className="feature-item" key={f.title}>
                                <div className="feature-icon">{f.icon}</div>
                                <div>
                                    <div className="feature-title">{f.title}</div>
                                    <div className="feature-desc">{f.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA Banner ──────────────────────────────────────── */}
            <section className="section">
                <div className="container" style={{ textAlign: 'center' }}>
                    <div className="section-header">
                        <span className="section-tag">New Arrivals</span>
                        <h2 className="section-title">Fresh from the Forest</h2>
                        <p className="section-desc">
                            Hand-picked ingredients from pristine forests and farms. Shop our latest collection.
                        </p>
                    </div>
                    <Link to="/shop" className="btn btn-primary" style={{ fontSize: '1rem', padding: '0.8rem 2rem' }}>
                        Explore the Collection <ArrowRight size={18} />
                    </Link>
                </div>
            </section>
        </main>
    )
}
