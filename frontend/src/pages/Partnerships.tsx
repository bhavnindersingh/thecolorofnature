import PageHeader from '../components/PageHeader'

interface PartnershipEntry {
    heading: string
    subheading: string
    body: string[]
    image: string
    imageAlt: string
}

const PARTNERSHIPS: PartnershipEntry[] = [
    {
        heading: 'A Fellowship Built on Water',
        subheading: 'As an Inaugural Fellow of the Levi Strauss and Co. Collaboratory, 2016',
        body: [
            'In 2016, Levi Strauss and Co. launched the Collaboratory, an annual fellowship for entrepreneurs committed to sustainable apparel.',
            'The fellowship that year centred on a single, urgent question: how do we reduce the water impact of apparel manufacturing? It was a question Jesus had been answering, quietly and practically, for over two decades.',
            'By the time he joined the Collaboratory, The Colours of Nature had been running the same fermentation water in its vats since 1993, not a drop wasted. He brought a working prototype to the fellowship, one designed to scale that same natural indigo fermentation process for industrial use.',
            'His goal for the fellowship was the same as it has always been: to share what he knows, and to keep learning.',
            'The Collaboratory fellows also worked alongside the team at LS&Co.\u2019s Eureka Innovation Lab, participated in workshops designed in partnership with the Aspen Institute, and were eligible for up to USD 50,000 in funding to advance their sustainability plans.',
            'Levi Strauss and Co. president and CEO Chip Bergh noted at the time that the selection was driven by bold thinking and a shared commitment to sustainable apparel. In Jesus, they found both.',
        ],
        image: 'https://placehold.co/900x600/1a2e4a/4a6a8a?text=Levi+Strauss+Collaboratory',
        imageAlt: 'Levi Strauss Collaboratory',
    },
    {
        heading: 'A Placeholder Partnership',
        subheading: 'Subtitle or year of the partnership',
        body: [
            'This is a placeholder for a second partnership entry. The layout alternates so that the image appears on the right and the text on the left.',
            'Replace this content with the details of the actual partnership when it is ready.',
        ],
        image: 'https://placehold.co/900x600/1a3a2a/4a7a5a?text=Partnership+2',
        imageAlt: 'Partnership placeholder',
    },
]

export default function Partnerships() {
    return (
        <main className="partnerships-page">
            <PageHeader name="Partnerships" />

            <section className="partnerships-intro">
                <p className="partnerships-intro-text">
                    We believe the best work happens when the right people work toward the same goal. Our partnerships are built on shared values, mutual growth, and a commitment to creating lasting impact.
                </p>
            </section>

            <div className="partnerships-logo-runner">
                <div className="partnerships-logo-track">
                    {[...Array(2)].map((_, set) =>
                        ['Logo One', 'Logo Two', 'Logo Three', 'Logo Four', 'Logo Five', 'Logo Six'].map((name) => (
                            <div key={`${set}-${name}`} className="partnerships-logo-item">
                                <img
                                    src={`https://placehold.co/160x60/18336B/ffffff?text=${encodeURIComponent(name)}`}
                                    alt={name}
                                />
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="partnerships-list">
                {PARTNERSHIPS.map((entry, i) => (
                    <article
                        key={entry.heading}
                        className={`partnerships-entry${i % 2 === 1 ? ' partnerships-entry--reverse' : ''}`}
                    >
                        <div className="partnerships-entry-image">
                            <img
                                src={entry.image}
                                alt={entry.imageAlt}
                                loading={i === 0 ? 'eager' : 'lazy'}
                            />
                        </div>
                        <div className="partnerships-entry-text">
                            <h2 className="partnerships-entry-heading">{entry.heading}</h2>
                            <p className="partnerships-entry-subheading"><em>{entry.subheading}</em></p>
                            <div className="partnerships-entry-body">
                                {entry.body.map((para, j) => (
                                    <p key={j} className="partnerships-entry-para">{para}</p>
                                ))}
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </main>
    )
}
