import { useState } from 'react'

export default function Footer() {
    const [helpOpen, setHelpOpen] = useState(false)
    const [policiesOpen, setPoliciesOpen] = useState(false)

    return (
        <footer className="footer">

            {/* ── Left: white panel ───────────────────────────────────────────── */}
            <div className="footer-left">
                <img
                    className="footer-logo"
                    src="/TCON Logo.png"
                    alt="The Colours of Nature"
                />
            </div>

            {/* ── Right: navy panel ───────────────────────────────────────────── */}
            <div className="footer-right">

                {/* Top row: dropdowns */}
                <div className="footer-dropdowns">

                    <div className="footer-dropdown">
                        <button
                            className="footer-dropdown-trigger"
                            onClick={() => { setHelpOpen(o => !o); setPoliciesOpen(false) }}
                        >
                            Need help? <span className={`footer-arrow ${helpOpen ? 'footer-arrow--up' : ''}`}></span>
                        </button>
                        {helpOpen && (
                            <ul className="footer-dropdown-menu">
                                <li><a href="/contact">Contact us</a></li>
                                <li><a href="/track">Track order</a></li>
                            </ul>
                        )}
                    </div>

                    <div className="footer-dropdown">
                        <button
                            className="footer-dropdown-trigger"
                            onClick={() => { setPoliciesOpen(o => !o); setHelpOpen(false) }}
                        >
                            Policies <span className={`footer-arrow ${policiesOpen ? 'footer-arrow--up' : ''}`}></span>
                        </button>
                        {policiesOpen && (
                            <ul className="footer-dropdown-menu">
                                <li><a href="/shipping">Shipping &amp; Payment</a></li>
                                <li><a href="/terms">Terms &amp; Conditions</a></li>
                                <li><a href="/returns">Return &amp; Exchange</a></li>
                                <li><a href="/privacy">Privacy Policy</a></li>
                            </ul>
                        )}
                    </div>

                </div>

                {/* Bottom row: links */}
                <div className="footer-links">
                    <a className="footer-link" href="/contact">Contact us</a>
                    <a className="footer-link" href="https://instagram.com" target="_blank" rel="noreferrer">Instagram</a>
                    <a className="footer-link" href="https://facebook.com" target="_blank" rel="noreferrer">Facebook</a>
                </div>

            </div>

        </footer>
    )
}
