import PageHeader from '../components/PageHeader'

export default function Privacy() {
    return (
        <main className="policy-page">
            <PageHeader name="Privacy Policy" />
            <div className="policy-content">

                <h1 className="policy-main-heading">Privacy Policy</h1>
                <p className="policy-updated">Last updated: January 2025</p>
                <p className="policy-body">This Privacy Policy describes how The Colours of Nature, a unit of the Auroville Foundation, collects, uses, and shares your personal information when you visit or make a purchase from www.thecoloursofnature.com. This Website is intended for individuals aged 10 and above.</p>

                <section className="policy-section">
                    <h2 className="policy-section-heading">Information We Collect</h2>

                    <h3 className="policy-sub-heading">Device Information</h3>
                    <p className="policy-body">When you visit our Website, we automatically collect certain information about your device, including your web browser type, IP address, time zone, and cookie data. As you browse, we also record the pages and products you view, the websites or search terms that referred you to us, and how you interact with the site.</p>
                    <p className="policy-body" style={{ marginTop: '1rem' }}>This information is collected through the following methods:</p>
                    <ul className="policy-list">
                        <li><strong>Cookies:</strong> Small data files placed on your device, often containing an anonymous unique identifier. To learn more about cookies or to disable them, visit www.allaboutcookies.org.</li>
                        <li><strong>Log Files:</strong> Records of activity on the Website, including IP addresses, browser types, internet service providers, and date and time stamps.</li>
                        <li><strong>Web Beacons, Tags, and Pixels:</strong> Electronic files that record information about how you browse and navigate the site.</li>
                    </ul>
                    <p className="policy-body" style={{ marginTop: '1rem' }}>We use device information to help us screen for potential risks and fraud, and to improve and optimise the Website. This includes generating analytics about browsing behaviour to assess the effectiveness of our marketing and sales activity.</p>

                    <h3 className="policy-sub-heading">Personal Information</h3>
                    <p className="policy-body">When you register on the Website, we collect the following:</p>
                    <ul className="policy-list">
                        <li>Name</li>
                        <li>Email address</li>
                        <li>Phone number</li>
                    </ul>

                    <h3 className="policy-sub-heading">Order Information</h3>
                    <p className="policy-body">When you place or attempt to place an order, we additionally collect:</p>
                    <ul className="policy-list">
                        <li>Billing and shipping address</li>
                        <li>Payment details, including relevant card information</li>
                    </ul>
                </section>

                <section className="policy-section">
                    <h2 className="policy-section-heading">How We Use Your Information</h2>
                    <p className="policy-body">Order information is used to fulfil purchases made through the Website. This includes processing payments, arranging shipping, and providing order confirmations and invoices. We also use this information to communicate with you and to screen orders for potential risks or fraud.</p>
                    <p className="policy-body" style={{ marginTop: '1rem' }}>With your consent, we may also use your information to send you updates about our products and services.</p>
                    <p className="policy-body" style={{ marginTop: '1rem' }}>Order information is retained for our records unless you request that it be deleted.</p>
                </section>

                <section className="policy-section">
                    <h2 className="policy-section-heading">How We Share Your Information</h2>
                    <p className="policy-body">We do not sell your personal information. We share your information only with trusted third parties where necessary to support the purposes described above, including fraud screening, site optimisation, and order fulfilment.</p>
                    <p className="policy-body" style={{ marginTop: '1rem' }}>We use Google Analytics to better understand how visitors use our Website. You can read about how Google uses your information at www.google.com/intl/en/policies/privacy, and opt out at tools.google.com/dlpage/gaoptout.</p>
                    <p className="policy-body" style={{ marginTop: '1rem' }}>We may also share your information where required by law, or in response to a lawful request from a regulatory or governmental authority.</p>
                </section>

                <section className="policy-section">
                    <h2 className="policy-section-heading">Targeted Advertising</h2>
                    <p className="policy-body">We may use your information to present you with relevant advertising. To learn more about how targeted advertising works, visit the Network Advertising Initiative at www.networkadvertising.org.</p>
                    <p className="policy-body" style={{ marginTop: '1rem' }}>You may opt out of targeted advertising through the following links:</p>
                    <ul className="policy-list">
                        <li>Facebook: www.facebook.com/settings/?tab=ads</li>
                        <li>Google: www.google.com/settings/ads/anonymous</li>
                        <li>Microsoft: advertise.bingads.microsoft.com/en-us/resources/policies/personalized-ads</li>
                        <li>Digital Advertising Alliance opt-out portal: optout.aboutads.info</li>
                    </ul>
                    <p className="policy-body" style={{ marginTop: '1rem' }}>Please note that we do not alter our data collection practices in response to Do Not Track signals from your browser.</p>
                </section>

                <section className="policy-section">
                    <h2 className="policy-section-heading">Your Rights</h2>
                    <p className="policy-body">You have the right to access, correct, update, or request deletion of any personal information we hold about you. To exercise any of these rights, please contact us using the details below.</p>
                </section>

                <section className="policy-section">
                    <h2 className="policy-section-heading">Changes to This Policy</h2>
                    <p className="policy-body">We may update this Privacy Policy from time to time to reflect changes in our practices or for operational, legal, or regulatory reasons. We encourage you to review this page periodically.</p>
                </section>

                <section className="policy-section">
                    <h2 className="policy-section-heading">Contact</h2>
                    <p className="policy-body">For any questions, concerns, or complaints regarding this Privacy Policy, please get in touch with us:</p>
                    <div className="policy-address-block">
                        <p className="policy-body">Email: <a href="mailto:shop@thecoloursofnature.com">shop@thecoloursofnature.com</a></p>
                        <p className="policy-body">Phone: +91 (0)413 262 2587</p>
                        <p className="policy-body">Post: The Colours of Nature, Auroshilpam, Auroville 605101, Tamil Nadu, India</p>
                    </div>
                </section>

            </div>
        </main>
    )
}
