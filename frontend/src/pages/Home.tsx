import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

const features = [
    { num: '01', title: '100% Natural', desc: 'Every product is sourced from nature, free from synthetic chemicals.' },
    { num: '02', title: 'Free Delivery', desc: 'Free shipping on all orders above ₹999 across India.' },
    { num: '03', title: 'Quality Assured', desc: 'Rigorously tested and certified for purity and potency.' },
    { num: '04', title: 'Eco Packaging', desc: 'Biodegradable packaging that gives back to the earth.' },
]

export default function Home() {
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
                        Discover our curated collection of 100% natural skincare, wellness and
                        lifestyle products — crafted with love, sourced from the earth.
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
                    <div className="hero-image-placeholder">🌿</div>
                </div>
            </section>

            {/* ── Features Strip ────────────────────────────────────────── */}
            <div className="features-strip">
                {features.map((f) => (
                    <div className="feature-item" key={f.num}>
                        <div className="feature-num">{f.num}</div>
                        <div className="feature-title">{f.title}</div>
                        <div className="feature-desc">{f.desc}</div>
                    </div>
                ))}
            </div>

            {/* ── CTA Banner ────────────────────────────────────────────── */}
            <div className="cta-banner">
                <div className="container">
                    <div className="section-header centered">
                        <span className="section-tag">New Arrivals</span>
                        <h2 className="section-title"><em>Fresh from the Forest</em></h2>
                        <p className="section-desc" style={{ color: 'rgba(250,248,245,0.6)', marginBottom: '2.5rem' }}>
                            Hand-picked ingredients from pristine forests and farms.
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
