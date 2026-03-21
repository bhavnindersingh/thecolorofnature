import PageHeader from '../components/PageHeader'

export default function Returns() {
    return (
        <main className="policy-page">
            <PageHeader name="Returns & Refunds" />
            <div className="policy-content">

                <h1 className="policy-main-heading">Returns &amp; Refunds</h1>
                <p className="policy-body">The Colours of Nature takes great care in crafting and delivering every order. Each piece leaves our studio in Auroville having passed through multiple stages of quality checks. We want you to love what you receive.</p>

                <section className="policy-section">
                    <h2 className="policy-section-heading">Cancellations</h2>
                    <p className="policy-body">In accordance with the Indian Consumer Protection (E-Commerce) Rules 2020, orders may be cancelled at any point before dispatch. Once an order has been dispatched, it can no longer be cancelled.</p>
                </section>

                <section className="policy-section">
                    <h2 className="policy-section-heading">Returns</h2>
                    <p className="policy-body">We accept returns under the following conditions:</p>
                    <ul className="policy-list">
                        <li>The return is initiated within 15 days of the date of purchase</li>
                        <li>The product is in its original condition, with all packaging, tags, and labels intact</li>
                        <li>The product has not been worn, washed, or altered in any way</li>
                        <li>The product is free of stains, odours, and damage</li>
                        <li>The product was purchased at full price</li>
                    </ul>
                    <p className="policy-body" style={{ marginTop: '1rem' }}>We reserve the right to refuse any return that does not meet these conditions.</p>
                </section>

                <section className="policy-section">
                    <h2 className="policy-section-heading">What Cannot Be Returned</h2>
                    <p className="policy-body">The following are not eligible for return under any circumstances:</p>
                    <ul className="policy-list">
                        <li>Products purchased more than 15 days prior to the return request</li>
                        <li>Products that have been worn, washed, or altered</li>
                        <li>Products without original packaging, tags, or labels</li>
                        <li>Sale or discounted items</li>
                        <li>Custom-made or personalised orders</li>
                    </ul>
                </section>

                <section className="policy-section">
                    <h2 className="policy-section-heading">How to Return</h2>
                    <p className="policy-body">To initiate a return, please write to us at <a href="mailto:shop@thecoloursofnature.com">shop@thecoloursofnature.com</a> within 15 days of purchase. Include your order number, date of transaction, delivery address, and photographs of the product.</p>
                    <p className="policy-body" style={{ marginTop: '1rem' }}>Once your return is approved, please send the product back to us in its original packaging at the address below. You are responsible for the cost of return shipping and for any risk associated with the return transit. We strongly recommend using an insured and trackable mail service, as The Colours of Nature cannot be held responsible for products lost or damaged during return shipment.</p>
                    <div className="policy-address-block">
                        <p className="policy-body"><strong>Return Address</strong></p>
                        <p className="policy-body">
                            The Colours of Nature<br />
                            Auroshilpam, Auroville<br />
                            Tamil Nadu 605101, India<br />
                            Phone: 0413 262 2587
                        </p>
                    </div>
                </section>

                <section className="policy-section">
                    <h2 className="policy-section-heading">Refunds</h2>
                    <p className="policy-body">Refunds are processed only upon physical receipt and inspection of the returned product. Once received and approved, the amount will be refunded to your original payment method within 5 to 7 working days.</p>
                    <p className="policy-body" style={{ marginTop: '1rem' }}>No refund will be issued in the following circumstances:</p>
                    <ul className="policy-list">
                        <li>An incorrect or incomplete shipping address was provided at the time of order</li>
                        <li>Three or more delivery attempts were unsuccessful due to recipient unavailability</li>
                        <li>The package was refused by the recipient</li>
                    </ul>
                </section>

                <section className="policy-section">
                    <h2 className="policy-section-heading">Disclaimer</h2>
                    <p className="policy-body">All policies are subject to change without prior notice. In the event of any conflict, the Terms and Conditions shall prevail.</p>
                </section>

                <p className="policy-body policy-closing">
                    For any questions or concerns, please write to us at <a href="mailto:shop@thecoloursofnature.com">shop@thecoloursofnature.com</a>. We are happy to assist.
                </p>

            </div>
        </main>
    )
}
