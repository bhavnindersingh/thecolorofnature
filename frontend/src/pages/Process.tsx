import PageHeader from '../components/PageHeader'

export default function Process() {
    return (
        <main className="process-page">
            <PageHeader name="Our Process" />

            <div className="process-intro">
                <div className="process-intro-left">
                    <h1 className="process-intro-heading">We dye and sew entirely in house</h1>
                    <p className="process-intro-aside">Between the two sits something rarer: a process with no waste, no shortcuts, and no synthetic inputs of any kind.</p>
                </div>

                <div className="process-intro-right">
                    <div className="process-intro-paras">
                        <p className="process-intro-body">
                            On one side of the process are living fermentation vats filled with natural indigo and a palette drawn entirely from plants, roots, bark, and flower.
                        </p>
                        <p className="process-intro-body">
                            On the other is a skilled team of artisans who cut, sew, and hand-embroider every piece on site. Between the two sits something rarer: a process with no waste, no shortcuts, and no synthetic inputs of any kind.
                        </p>
                    </div>
                    <div className="process-intro-image">
                        <img
                            src="/process-sewing.png"
                            alt=""
                            loading="eager"
                        />
                    </div>
                </div>
            </div>

            {/* ── Resistance dyeing section ───────────────────────────────────── */}
            <div className="process-resistance">

                <div className="process-resistance-header">
                    <h2 className="process-intro-heading">The Art of Resistance</h2>
                    <p className="process-intro-body">
                        Some of the most striking patterns in textile art are made not by adding colour, but by keeping it out.
                    </p>
                </div>

                <div className="process-resistance-images">
                    <div className="process-resistance-card">
                        <img src="https://placehold.co/800x600/e8e3dc/8a8a82?text=placeholder" alt="" />
                        <div className="process-resistance-overlay">
                            <h3 className="process-overlay-heading">Shibori</h3>
                            <p className="process-overlay-body">An ancient Japanese technique in which cloth is folded, twisted, compressed, or bound before dyeing. Each method of resistance creates its own geometry — no two pieces are ever identical. At The Colours of Nature, shibori is practised with natural indigo, allowing the plant and the hand to decide the final pattern together.</p>
                        </div>
                    </div>
                    <div className="process-resistance-card">
                        <img src="https://placehold.co/800x600/e8e3dc/8a8a82?text=placeholder" alt="" />
                        <div className="process-resistance-overlay">
                            <h3 className="process-overlay-heading">Batik</h3>
                            <p className="process-overlay-body">A wax-resist technique with roots across Indonesia, India, and West Africa. Hot wax is applied to cloth in precise patterns; when dyed, the waxed areas remain undyed. At The Colours of Nature, batik is executed entirely with natural dyes, producing richly layered surfaces that carry the mark of every hand involved in their making.</p>
                        </div>
                    </div>
                </div>

            </div>

            {/* ── Plant palette section ───────────────────────────────────────── */}
            <div className="process-palette">
                <h2 className="process-intro-heading">The plant palette</h2>
                <div className="process-palette-list">
                    <p className="process-palette-entry"><strong>Indigo (Indigofera Tinctoria)</strong> The colour that started it all. Extracted from the leaves of the indigofera plant and brought to life through living fermentation, natural indigo produces the deep, rich blues that have defined our work since 1993. No two vats are identical. No two batches are exactly the same. That is what makes it indigo.</p>
                    <p className="process-palette-entry"><strong>Jackfruit Tree</strong> It is the tree, not the fruit, that gives us rich golden yellows. We use the sawdust left over from woodworking, a by-product that would otherwise go to waste, making this one of our favourite examples of upcycling in action. Myrobalan is used as a mordant in the process.</p>
                    <p className="process-palette-entry"><strong>Myrobalan (Terminalia Chebula)</strong> The dried fruit of a tall tree native to India, myrobalan works both as a mordant and as a dye in its own right. On its own, it yields a soft, buttery yellow. Combined with iron, it shifts into warm khaki.</p>
                    <p className="process-palette-entry"><strong>Pomegranate</strong> The rind, not the fruit, is what we use here. Rich in tannins, pomegranate peel produces a highly lightfast yellow whose exact hue depends on the ripeness of the fruit at harvest.</p>
                    <p className="process-palette-entry"><strong>Sappan Wood</strong> A favourite in the studio for its range. Sappan wood gives us luscious pinks, deep purples, and exquisite reds. The active dyestuff is brazilin, and while the colour can be demanding to work with, we have spent years learning its temperament.</p>
                    <p className="process-palette-entry"><strong>Madder (Rubia Cordifolia)</strong> Known in India as Manjistha, madder has been used to dye silk and wool red since ancient times. It is the roots of this creeping flowering plant that carry the colour. A deep, warm red with serious history behind it.</p>
                    <p className="process-palette-entry"><strong>Marigold</strong> Dried marigold flowers, ground to powder and simmered, produce a clean yellow that shifts depending on what it is combined with. Widely available and relatively forgiving, it is one of the more accessible dyes in our palette and no less beautiful for it.</p>
                </div>
            </div>

            {/* ── Contact CTA section ─────────────────────────────────────────── */}
            <div className="process-cta">
                <div className="process-cta-image">
                    <img src="/process-label.jpg" alt="" />
                </div>
                <p className="process-cta-text">
                    We have been dyeing and sewing since 1993. If you are a brand looking for a natural dye partner, a designer sourcing responsibly made textiles, a label seeking end-to-end garment production, or simply someone who wants to understand the process better, we would love to hear from you.
                </p>
            </div>

        </main>
    )
}
