import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getProducts, type Product } from '../lib/supabase'

const HERO_IMAGES = [
    'https://placehold.co/1920x1080/1a2e1a/4a6a4a?text=Image+1',
    'https://placehold.co/1920x1080/18336B/7a9abf?text=Image+2',
    'https://placehold.co/1920x1080/2a1a0e/8a6a4a?text=Image+3',
]

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
    const [heroIdx, setHeroIdx] = useState(0)

    useEffect(() => {
        const t = setInterval(() => setHeroIdx(i => (i + 1) % HERO_IMAGES.length), 3000)
        return () => clearInterval(t)
    }, [])

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
                {HERO_IMAGES.map((src, i) => (
                    <img
                        key={src}
                        src={src}
                        alt=""
                        className={`hero-slide${i === heroIdx ? ' hero-slide--active' : ''}`}
                    />
                ))}
            </section>

            <section className="section" style={{ textAlign: 'center', paddingTop: '4rem', paddingBottom: '4rem' }}>
                <div className="container">
                    <h2 className="section-title" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
                        Natural dyes are alive. They deepen in character over time.
                    </h2>
                    <p className="section-desc" style={{ maxWidth: '600px', margin: '1.5rem auto 3rem', fontSize: '1rem' }}>
                        Free from harsh chemicals, our dyeing processes respect the pace of living colour — unhurried, unforced, and wholly natural.
                    </p>

                    <div className="gallery-grid">
                        <div className="gallery-item-1">
                            <img src="/gallery-1.jpg" alt="Woman holding blue fabric" />
                        </div>
                        <div className="gallery-item-2">
                            <img src="/gallery-2.jpg" alt="Drying blue yarn on bamboo racks" />
                        </div>
                        <div className="gallery-item-3">
                            <img src="/gallery-3.jpg" alt="People walking with fabric" />
                            <div className="gallery-text-overlay">
                                <h3>Fabric that carries the process</h3>
                                <Link to="/process" className="gallery-link">Explore more</Link>
                            </div>
                        </div>
                        <div className="gallery-item-4">
                            <img src="/gallery-4.jpg" alt="Artisan dyeing fabric" />
                            <div className="gallery-button-overlay">
                                <Link to="/shop" className="btn btn-primary" style={{ background: 'var(--surface)', color: 'var(--ink)' }}>
                                    SHOP <ArrowRight size={14} strokeWidth={1.5} />
                                </Link>
                            </div>
                        </div>
                    </div>
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

            {/* ── Sticky Scroll Section ──────────────────────────────────── */}
            <div className="sticky-wrapper">
                {/* LEFT: Sticky image that stays fixed while you scroll */}
                <div className="sticky-component">
                    <img 
                        src="https://cdn.prod.website-files.com/6996b537e802c970c8d73448/6996f547318d9661cd2d682c_CON26.jpg"
                        loading="lazy"
                        sizes="(max-width: 1635px) 100vw, 1635px"
                        srcSet="https://cdn.prod.website-files.com/6996b537e802c970c8d73448/6996f547318d9661cd2d682c_CON26-p-500.jpg 500w,
                                https://cdn.prod.website-files.com/6996b537e802c970c8d73448/6996f547318d9661cd2d682c_CON26-p-800.jpg 800w,
                                https://cdn.prod.website-files.com/6996b537e802c970c8d73448/6996f547318d9661cd2d682c_CON26-p-1080.jpg 1080w,
                                https://cdn.prod.website-files.com/6996b537e802c970c8d73448/6996f547318d9661cd2d682c_CON26-p-1600.jpg 1600w,
                                https://cdn.prod.website-files.com/6996b537e802c970c8d73448/6996f547318d9661cd2d682c_CON26.jpg 1635w"
                        alt=""
                    />
                </div>

                {/* RIGHT: Scrollable content */}
                <div className="sticky-content">
                    {/* Big image 1 */}
                    <div className="sticky-big-image">
                        <img 
                            src="https://cdn.prod.website-files.com/6996b537e802c970c8d73448/6996f54a90fba6a788f61968_CON39.jpg"
                            loading="lazy"
                            sizes="(max-width: 1635px) 100vw, 1635px"
                            srcSet="https://cdn.prod.website-files.com/6996b537e802c970c8d73448/6996f54a90fba6a788f61968_CON39-p-500.jpg 500w,
                                    https://cdn.prod.website-files.com/6996b537e802c970c8d73448/6996f54a90fba6a788f61968_CON39-p-800.jpg 800w,
                                    https://cdn.prod.website-files.com/6996b537e802c970c8d73448/6996f54a90fba6a788f61968_CON39-p-1080.jpg 1080w,
                                    https://cdn.prod.website-files.com/6996b537e802c970c8d73448/6996f54a90fba6a788f61968_CON39-p-1600.jpg 1600w,
                                    https://cdn.prod.website-files.com/6996b537e802c970c8d73448/6996f54a90fba6a788f61968_CON39.jpg 1635w"
                            alt=""
                        />
                    </div>

                    {/* Text block 1 */}
                    <div className="sticky-text">
                        <div className="text-weight-medium caps regular-vw-small">A Process, Not a Shortcut</div>
                        <div className="content max-width-34vw">
                            <div className="heading-vw">Where Indigo Takes Form</div>
                            <div className="sticky-paragraph">
                                <div className="regular-vw">Leaves are tended, vats are listened to, and colour is allowed to arrive in its own time. Nothing is rushed. Each shade deepens through repetition, guided by instinct, memory, and a quiet understanding between hand, water, and plant.</div>
                                <div className="regular-vw">Dye created through patience and presence. What emerges is not just colour, but depth formed through time, care, and attention.</div>
                            </div>
                        </div>
                    </div>

                    {/* Small image 1 */}
                    <div className="sticky-small-image">
                        <img 
                            src="https://cdn.prod.website-files.com/6996b537e802c970c8d73448/6996f5461591de52e09bde13_CON21.jpg"
                            loading="lazy"
                            alt=""
                            className="image-parallax"
                        />
                    </div>

                    {/* Medium image */}
                    <div className="sticky-medium-image">
                        <img 
                            src="https://cdn.prod.website-files.com/6996b537e802c970c8d73448/6996f5472e0859c7428bf241_CON27.jpg"
                            loading="lazy"
                            alt=""
                            className="image-parallax"
                        />
                    </div>

                    {/* Text block 2 */}
                    <div className="sticky-text">
                        <div className="text-weight-medium caps regular-vw-small">Wisdom in the Process</div>
                        <div className="content">
                            <div className="heading-vw">The artisan as keeper of knowledge</div>
                            <div className="sticky-paragraph">
                                <div className="regular-vw">Time is spent listening to the vat, watching colour shift, feeling the fabric respond. Everything is allowed to arrive as it should.</div>
                                <div className="regular-vw">Our colours hold depth rather than uniformity. Each piece carries subtle differences, shaped by the day it was dyed and the conditions surrounding it.</div>
                            </div>
                        </div>
                    </div>

                    {/* Small image 2 */}
                    <div className="sticky-small-image">
                        <img
                            src="https://cdn.prod.website-files.com/6996b537e802c970c8d73448/6996f5450812332a25893226_CON16.jpg"
                            loading="lazy"
                            width="150"
                            height="1000"
                            sizes="150px"
                            alt=""
                            className="image-parallax"
                        />
                    </div>

                    {/* Text block 3 */}
                    <div className="sticky-text">
                        <div className="text-weight-medium caps regular-vw-small">The quiet generosity of plants</div>
                        <div className="content">
                            <div className="heading-vw">Colour Beyond Indigo</div>
                            <div className="sticky-paragraph">
                                <div className="regular-vw">Other plants enter the process quietly, each offering colour through wood, root, rind, or flower. The jackfruit tree brings warm yellows through upcycled sawdust, prepared with natural mordants like myrobalan, a fruit that also lends soft buttery tones of its own. Pomegranate rind yields delicate, lightfast yellows, while sappan wood reveals luminous pinks, purples, and reds. Beneath the soil, madder root, known as manjistha, carries a deep enduring red, and dried marigold flowers release gentle yellows that shift with the dye bath. Each plant adds its own quiet note to the palette.</div>
                            </div>
                        </div>
                    </div>

                    {/* End image — starts right after text, bottom aligns with left sticky image */}
                    <div className="sticky-end-image">
                        <img
                            src="/end-image.jpg"
                            alt="Red fabric drying on bamboo racks"
                        />
                    </div>

                </div>
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

        </main>
    )
}
