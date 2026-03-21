import { useEffect, useRef } from 'react'
import PageHeader from '../components/PageHeader'

export default function About() {

    // ── Columns heading: stretch line-height to match paragraph column height ──
    const columnsLabelRef = useRef<HTMLDivElement>(null)
    const columnsParsasRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const label = columnsLabelRef.current
        const paras = columnsParsasRef.current
        if (!label || !paras) return

        const fit = () => {
            // Measure the natural text height at line-height:1
            label.style.alignSelf = 'start'
            label.style.lineHeight = '1'
            const naturalHeight = label.offsetHeight
            // Restore stretching, then measure the paragraph column height
            label.style.alignSelf = ''
            label.style.lineHeight = ''
            const targetHeight = paras.offsetHeight
            if (naturalHeight > 0 && targetHeight > naturalHeight) {
                label.style.lineHeight = String(targetHeight / naturalHeight)
            }
        }

        fit()
        const ro = new ResizeObserver(fit)
        ro.observe(paras)
        return () => ro.disconnect()
    }, [])

    // ── B&W image + sliding text overlay ─────────────────────────────────────
    const bioSectionRef = useRef<HTMLDivElement>(null)
    const bioImgWrapRef = useRef<HTMLDivElement>(null)
    const bioTextRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const section = bioSectionRef.current
        const imgWrap = bioImgWrapRef.current
        const text = bioTextRef.current
        if (!section || !imgWrap || !text) return

        const update = () => {
            const vh = window.innerHeight
            const scrolled = Math.max(0, -section.getBoundingClientRect().top)
            const totalRange = section.offsetHeight - vh

            // Text begins flowing after a short pause (15% of totalRange) so the
            // image is visible briefly before text enters from below.
            const textStartScroll = totalRange * 0.15
            const elapsed = scrolled - textStartScroll
            const textY = elapsed < 0 ? vh : vh - elapsed
            text.style.transform = `translateY(${textY}px)`
            text.style.visibility = 'visible'
        }

        const imgEl = imgWrap.querySelector('img') as HTMLImageElement
        if (imgEl && !imgEl.complete) imgEl.addEventListener('load', update, { once: true })
        update()
        window.addEventListener('scroll', update, { passive: true })
        return () => window.removeEventListener('scroll', update)
    }, [])

    return (
        <main className="about-page">
            <PageHeader name="About" />

            {/* ── Hero: text left + full-width image below ───────────────────── */}
            <section className="about-hero-text-section">
                <blockquote className="about-hero-quote">
                    "Our mission is simple, even if the work is not: to keep water<br />
                    clean, keep ancient knowledge alive, and keep people<br />
                    employed with dignity."
                </blockquote>
                <cite className="about-hero-attr">— Jesus Ciriza Larraona</cite>
            </section>

            <div className="about-strip">
                <div className="about-strip-track">
                    <img className="about-strip-img" src="/CON19.jpg" alt="" />
                    <img className="about-strip-img" src="/CON20.jpg" alt="" />
                    <img className="about-strip-img" src="/CON21.jpg" alt="" />
                    <img className="about-strip-img" src="/CON50.jpg" alt="" />
                    <img className="about-strip-img" src="/CON19.jpg" alt="" />
                    <img className="about-strip-img" src="/CON20.jpg" alt="" />
                    <img className="about-strip-img" src="/CON21.jpg" alt="" />
                    <img className="about-strip-img" src="/CON50.jpg" alt="" />
                </div>
            </div>

            {/* ── 3-column text section ──────────────────────────────────────── */}
            <div className="about-columns-section">
                <div className="about-columns-label" ref={columnsLabelRef}>The Beginning of an Obsession</div>
                <div className="about-columns-paras" ref={columnsParsasRef}>
                    <p className="about-columns-body">It was in Kottakarai, a small village in the southern Indian community of Auroville, that Jesus Ciriza Larraona began the adventure of The Colours of Nature in 1993.</p>
                    <p className="about-columns-body">A natural-dye research centre and production house built on a single conviction: that plant-based colour, made with full ecological responsibility, could meet the highest standards of global fashion and textiles.</p>
                    <p className="about-columns-body">He began with four vats of 200 litres each. Today, there are 62 submerged vats of 1,000 litres, every one fabricated locally in Auroville, every one tended to daily.</p>
                </div>
                <div className="about-columns-paras">
                    <p className="about-columns-body">Fed, cared for, and yes, loved.</p>
                    <p className="about-columns-body">That is not a metaphor. A fermentation vat is a living thing, and at The Colours of Nature, it is treated as such.</p>
                    <p className="about-columns-body">The palette has grown from indigo to the full spectrum of what nature makes available. The operation now provides livelihoods for over a hundred people. In thirty years, not a drop of water has been wasted. Fabric offcuts are collected and reused through patchwork and appliqué. The process is fully circular, not by certification, but by design.</p>
                </div>
            </div>

            {/* ── B&W image + text overlay ───────────────────────────────────── */}
            <div className="about-bio-scroll" ref={bioSectionRef}>
                <div className="about-bio-sticky">

                    <div className="about-bio-image-wrap" ref={bioImgWrapRef}>
                        <img
                            className="about-bio-image"
                            src="/ff.jpg"
                            alt=""
                            loading="lazy"
                        />
                    </div>

                    <div className="about-bio-text" ref={bioTextRef}>
                        <span className="about-bio-label">Learning the World's Blue</span>
                        <p className="about-bio-body">
                            Jesus did not stop with what India could teach him. He studied Japanese indigo fermentation and learned directly from sukumo masters. He travelled to Mexico, absorbing techniques from dyers with their own centuries-old traditions. He went further still, to Korea, Thailand, and other regions where indigo had evolved its own distinct philosophies of colour, water, and plant chemistry.
                        </p>
                        <p className="about-bio-body">
                            Across cultures, he gathered not just methods but ways of thinking about dye: about bacteria, about mineral balance, about the patience that fermentation demands and the consequences of rushing it.
                        </p>
                        <p className="about-bio-body">
                            In parallel, he developed a thorough understanding of the chemistry involved, covering pigments, tannins, metal salts, reduction and oxidation cycles, water quality, and fastness properties. What began as an intuitive craft became a scientific discipline. Decades of experimentation gave it rigour. Neither the intuition nor the science was ever abandoned for the other.
                        </p>
                    </div>

                </div>
            </div>

            {/* ── Meet the Team ───────────────────────────────────────────── */}
            <section className="meet-team-section">
                <h2 className="meet-team-heading">Meet the Team</h2>
                <p className="meet-team-body">
                    Behind every vat, every colour, and every piece of cloth is a person. Here are the people who make The Colours of Nature what it is.
                </p>
                <div className="meet-team-image-wrap">
                    <img src="/team-photo.jpg" alt="The Colours of Nature team" />
                </div>
            </section>

        </main>
    )
}
