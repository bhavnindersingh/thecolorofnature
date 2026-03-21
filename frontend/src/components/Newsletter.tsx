export default function Newsletter() {
    return (
        <div className="newsletter-bar">
            <div className="newsletter-left">
                <p className="newsletter-heading">Stay in the Loop</p>
                <p className="newsletter-body">Sign up to hear about new releases, collaborations, and more.</p>
            </div>
            <div className="newsletter-right">
                <input
                    className="newsletter-input"
                    type="email"
                    placeholder="Email"
                />
            </div>
        </div>
    )
}
