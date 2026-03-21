import PageHeader from '../components/PageHeader'

export default function ShippingPayments() {
    return (
        <main className="policy-page">
            <PageHeader name="Shipping & Payment" />
            <div className="policy-content">
                <p className="policy-updated">Updated on 19 March 2026</p>
                <h1 className="policy-main-heading">Shipping &amp; Payments</h1>

                <section className="policy-section">
                    <h2 className="policy-section-heading">Domestic Shipping</h2>

                    <h3 className="policy-sub-heading">Delivery Timeline</h3>
                    <p className="policy-body">Orders are dispatched within 2 to 6 business days of placement. Delivery typically takes 4 to 5 business days from dispatch. Shipping times are approximate and cannot be guaranteed. If you are working to a deadline, we recommend placing your order early.</p>

                    <h3 className="policy-sub-heading">Shipping Charges</h3>
                    <p className="policy-body">Shipping and handling charges are calculated based on the product's size, value, and destination, and will be displayed at checkout. Orders above INR 30,000 qualify for free shipping.</p>

                    <h3 className="policy-sub-heading">Payment Methods</h3>
                    <p className="policy-body">We accept all major debit and credit cards including Visa, MasterCard, and American Express, as well as net banking, UPI, and wallets. Cash on Delivery is not available.</p>
                </section>

                <section className="policy-section">
                    <h2 className="policy-section-heading">How We Ship</h2>
                    <p className="policy-body">We ship via Indian Speed Post, which includes track and trace on all orders. Once your order has been dispatched, tracking details will be sent to your registered email address. You can monitor your delivery status directly on the India Post website using the information provided.</p>
                </section>

                <section className="policy-section">
                    <h2 className="policy-section-heading">A Few Things to Know</h2>

                    <h3 className="policy-sub-heading">Accurate Shipping Details</h3>
                    <p className="policy-body">Please ensure your shipping address is complete and correct at checkout, including your full name, address, city, state, pin code, any relevant landmarks, and a contact number. An alternate number is helpful where possible. The Colours of Nature cannot be held responsible for delays or failed deliveries resulting from incomplete or inaccurate information.</p>

                    <h3 className="policy-sub-heading">If You Are Unavailable at Delivery</h3>
                    <p className="policy-body">India Post will attempt delivery and, if unsuccessful, will contact you to arrange a re-delivery or allow you to collect the parcel from your nearest post office. If your order is being delivered to an office address, please note that it may be received at the security desk. We recommend checking there in the first instance.</p>

                    <h3 className="policy-sub-heading">Public Holidays</h3>
                    <p className="policy-body">We process orders on all working days between 9am and 5pm IST, Monday to Friday. During public holidays, dispatch and delivery may be delayed. We appreciate your understanding and encourage you to plan accordingly.</p>

                    <h3 className="policy-sub-heading">Unforeseen Circumstances</h3>
                    <p className="policy-body">We will always do our best to get your order to you as quickly as possible. However, The Colours of Nature cannot be held responsible for delays caused by natural calamities, unforeseen disruptions, or circumstances outside our control.</p>
                </section>

                <p className="policy-body policy-closing">
                    For any questions about your order, write to us at <a href="mailto:shop@thecoloursofnature.com">shop@thecoloursofnature.com</a>. We are happy to help.
                </p>
            </div>

        </main>
    )
}
