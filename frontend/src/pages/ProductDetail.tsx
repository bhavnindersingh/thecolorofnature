import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Heart, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react'
import { getProductById, addToWishlist, type Product, type ProductVariant } from '../lib/supabase'

export default function ProductDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [selectedSize, setSelectedSize] = useState<string | null>(null)
    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
    const [activeImg, setActiveImg] = useState(0)
    const [wished, setWished] = useState(false)
    const [addedMsg, setAddedMsg] = useState(false)
    const [sizeError, setSizeError] = useState(false)

    const { data: product, isLoading, error } = useQuery({
        queryKey: ['product', id],
        queryFn: async () => {
            const { data, error } = await getProductById(Number(id))
            if (error) throw error
            return data as Product
        },
        enabled: !!id,
    })

    // ── Derived data ────────────────────────────────────────────────────────────
    const images = product?.product_images?.sort((a, b) => a.display_order - b.display_order) ?? []
    const primaryImg = images.find(i => i.is_primary) ?? images[0]
    const allImages = primaryImg
        ? [primaryImg, ...images.filter(i => i.id !== primaryImg.id)]
        : images

    const allSizes = product?.product_variants
        ? [...new Set(product.product_variants.map(v => v.size).filter(Boolean))]
        : []

    const colourGroups = product?.product_variants
        ? [...new Map(product.product_variants.filter(v => v.color_hex).map(v => [v.color, v])).values()]
        : []

    const effectivePrice = product
        ? product.price + (selectedVariant?.price_adjustment ?? 0)
        : 0

    const currentImageSrc = allImages[activeImg]?.image_url ?? product?.image_url ?? ''

    // ── Handlers ────────────────────────────────────────────────────────────────
    const selectSize = (size: string) => {
        setSelectedSize(size)
        setSizeError(false)
        const match = product?.product_variants?.find(v => v.size === size)
        setSelectedVariant(match ?? null)
    }

    const addToCart = () => {
        if (allSizes.length > 0 && !selectedSize) {
            setSizeError(true)
            return
        }
        const cartItem = { ...product, selectedSize, selectedVariant }
        const cart: unknown[] = JSON.parse(localStorage.getItem('cart') || '[]')
        cart.push(cartItem)
        localStorage.setItem('cart', JSON.stringify(cart))
        window.dispatchEvent(new Event('cart-updated'))
        setAddedMsg(true)
        setTimeout(() => setAddedMsg(false), 2000)
    }

    const toggleWish = async () => {
        setWished(w => !w)
        try { if (id) await addToWishlist(Number(id)) } catch { /* ok */ }
    }

    const prevImg = () => setActiveImg(i => (i - 1 + allImages.length) % allImages.length)
    const nextImg = () => setActiveImg(i => (i + 1) % allImages.length)

    // ── Loading / Error states ───────────────────────────────────────────────────
    if (isLoading) return (
        <main className="pdp-page">
            <div className="pdp-grid">
                <div className="pdp-gallery">
                    <div className="pdp-main-img skeleton-img" style={{ aspectRatio: '3/4', borderRadius: 0 }} />
                </div>
                <div className="pdp-info">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="skeleton-line short" style={{ height: 14 }} />
                        <div className="skeleton-line" style={{ height: 40, width: '80%' }} />
                        <div className="skeleton-line mid" style={{ height: 20, width: '30%' }} />
                    </div>
                </div>
            </div>
        </main>
    )

    if (error || !product) return (
        <main className="pdp-page">
            <div className="container" style={{ paddingTop: '8rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--ink-muted)', marginBottom: '2rem' }}>Product not found.</p>
                <Link to="/shop" className="btn btn-outline btn-sm">← Back to Shop</Link>
            </div>
        </main>
    )

    return (
        <main className="pdp-page">
            {/* ── Breadcrumb ─────────────────────────────────────────────── */}
            <div className="pdp-breadcrumb container">
                <button onClick={() => navigate(-1)} className="pdp-back">
                    <ArrowLeft size={14} strokeWidth={1.5} /> Back
                </button>
                <span className="pdp-breadcrumb-sep">/</span>
                <Link to="/shop" className="pdp-breadcrumb-link">Shop</Link>
                {product.category && (
                    <>
                        <span className="pdp-breadcrumb-sep">/</span>
                        <span className="pdp-breadcrumb-link">{product.category}</span>
                    </>
                )}
                <span className="pdp-breadcrumb-sep">/</span>
                <span style={{ color: 'var(--ink)' }}>{product.name}</span>
            </div>

            <div className="container">
                <div className="pdp-grid">
                    {/* ── Gallery ────────────────────────────────────────── */}
                    <div className="pdp-gallery">
                        {/* Thumbnails */}
                        {allImages.length > 1 && (
                            <div className="pdp-thumbs">
                                {allImages.map((img, i) => (
                                    <button
                                        key={img.id}
                                        className={`pdp-thumb${activeImg === i ? ' active' : ''}`}
                                        onClick={() => setActiveImg(i)}
                                        aria-label={`View image ${i + 1}`}
                                    >
                                        <img src={img.image_url} alt={img.alt_text ?? product.name} />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Main image */}
                        <div className="pdp-main-img-wrap">
                            {currentImageSrc
                                ? <img src={currentImageSrc} alt={product.name} className="pdp-main-img" key={currentImageSrc} />
                                : <div className="product-card-placeholder" style={{ aspectRatio: '3/4' }}>🌿</div>
                            }
                            {allImages.length > 1 && (
                                <>
                                    <button className="pdp-arrow pdp-arrow--left" onClick={prevImg}><ChevronLeft size={18} strokeWidth={1} /></button>
                                    <button className="pdp-arrow pdp-arrow--right" onClick={nextImg}><ChevronRight size={18} strokeWidth={1} /></button>
                                </>
                            )}
                            {allImages.length > 1 && (
                                <div className="pdp-dots">
                                    {allImages.map((_, i) => (
                                        <button key={i} className={`pdp-dot${activeImg === i ? ' active' : ''}`} onClick={() => setActiveImg(i)} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Product Info ────────────────────────────────────── */}
                    <div className="pdp-info">
                        {product.category && <span className="pdp-category">{product.category}</span>}
                        <h1 className="pdp-title">{product.name}</h1>
                        <div className="pdp-price">₹{effectivePrice.toLocaleString('en-IN')}</div>

                        {product.description && (
                            <p className="pdp-description">{product.description}</p>
                        )}

                        <hr className="divider" style={{ margin: '1.5rem 0' }} />

                        {/* Colour swatches */}
                        {colourGroups.length > 0 && (
                            <div className="pdp-section">
                                <div className="pdp-label">Colour</div>
                                <div className="pdp-colour-swatches">
                                    {colourGroups.map(v => (
                                        <button
                                            key={v.color}
                                            className="pdp-colour-swatch"
                                            style={{ background: v.color_hex! }}
                                            title={v.color ?? ''}
                                            aria-label={v.color ?? ''}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Size selector */}
                        {allSizes.length > 0 && (
                            <div className="pdp-section">
                                <div className="pdp-label" style={{ color: sizeError ? '#b94040' : undefined }}>
                                    Size {sizeError && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— please select a size</span>}
                                </div>
                                <div className="pdp-sizes">
                                    {allSizes.map(size => {
                                        const variant = product.product_variants?.find(v => v.size === size)
                                        const inStock = (variant?.stock_quantity ?? 0) > 0
                                        return (
                                            <button
                                                key={size}
                                                disabled={!inStock}
                                                className={`pdp-size-btn${selectedSize === size ? ' active' : ''}${!inStock ? ' oos' : ''}`}
                                                onClick={() => inStock && selectSize(size!)}
                                            >
                                                {size}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* CTA */}
                        <div className="pdp-cta">
                            <button
                                className={`pdp-add-btn${addedMsg ? ' added' : ''}`}
                                onClick={addToCart}
                                id="pdp-add-to-cart"
                            >
                                <ShoppingBag size={15} strokeWidth={1.5} />
                                {addedMsg ? 'Added to Cart ✓' : 'Add to Cart'}
                            </button>
                            <button
                                className={`pdp-wish-btn${wished ? ' wished' : ''}`}
                                onClick={toggleWish}
                                aria-label="Wishlist"
                            >
                                <Heart size={18} strokeWidth={1.5} fill={wished ? 'currentColor' : 'none'} />
                            </button>
                        </div>

                        {/* Details */}
                        <div className="pdp-details">
                            <details className="pdp-accordion">
                                <summary className="pdp-accordion-head">Product Details</summary>
                                <div className="pdp-accordion-body">
                                    <ul>
                                        <li>100% natural fibres — {product.category ?? 'fashion'}</li>
                                        <li>Ethically sourced and sustainably produced</li>
                                        <li>Dry clean or gentle hand wash</li>
                                        {product.product_variants?.[0]?.sku && (
                                            <li>SKU: {product.product_variants[0].sku.split('-').slice(0, 2).join('-')}</li>
                                        )}
                                    </ul>
                                </div>
                            </details>
                            <details className="pdp-accordion">
                                <summary className="pdp-accordion-head">Shipping & Returns</summary>
                                <div className="pdp-accordion-body">
                                    <ul>
                                        <li>Free shipping on orders above ₹999</li>
                                        <li>Delivered in 3–7 business days</li>
                                        <li>Easy returns within 14 days of delivery</li>
                                    </ul>
                                </div>
                            </details>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}
