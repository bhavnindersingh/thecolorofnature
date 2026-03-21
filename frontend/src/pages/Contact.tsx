import { Phone, Mail } from 'lucide-react'
import PageHeader from '../components/PageHeader'

export default function Contact() {
    return (
        <main className="contact-page">
            <PageHeader name="Contact" />

            {/* ── Section 1: address details ──────────────────────────────────── */}
            <div className="contact-details">
                <h1 className="contact-details-heading">Contact Us</h1>
                <p className="contact-address">
                    The Colours of Nature<br />
                    Auroshilpam, Auroville, 605101, Tamil Nadu (INDIA)
                </p>
                <div className="contact-info-row">
                    <Phone size={14} strokeWidth={1.5} />
                    <span>+91 (0)413 2622587</span>
                </div>
                <div className="contact-info-row">
                    <Mail size={14} strokeWidth={1.5} />
                    <span>colnature@gmail.com</span>
                </div>
            </div>

            {/* ── Section 2: contact form ─────────────────────────────────────── */}
            <div className="contact-form-section">
                <h2 className="contact-form-heading">Get in Touch</h2>
                <form className="contact-form">
                    <div className="contact-form-row">
                        <input className="contact-input" type="text" placeholder="Name" />
                        <input className="contact-input" type="email" placeholder="E-mail" />
                    </div>
                    <textarea className="contact-textarea" placeholder="Message" rows={6} />
                    <button className="contact-submit" type="submit">Send Message</button>
                </form>
            </div>

        </main>
    )
}
