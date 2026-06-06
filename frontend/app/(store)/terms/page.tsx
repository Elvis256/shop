"use client";

export default function TermsPage() {
  return (
    <div className="container py-12 max-w-3xl">
      <h1 className="mb-8">Terms of Service</h1>

      <div className="space-y-6 text-text-muted leading-relaxed">
        <p className="text-text font-medium">Last updated: June 2026</p>

        <section>
          <h3 className="text-text mb-2">1. Age Requirement</h3>
          <p>You must be at least 18 years old to use this website and purchase products. By using our site, you confirm that you meet this age requirement.</p>
        </section>

        <section>
          <h3 className="text-text mb-2">2. Account Responsibilities</h3>
          <p>You are responsible for maintaining the security of your account credentials. Notify us immediately of any unauthorized access. We reserve the right to suspend accounts that violate these terms.</p>
        </section>

        <section>
          <h3 className="text-text mb-2">3. Orders & Pricing</h3>
          <p>All prices are listed in UGX unless otherwise specified. We reserve the right to modify prices without notice. Orders are confirmed only after successful payment processing. We may cancel orders if products are unavailable or pricing errors occur.</p>
        </section>

        <section>
          <h3 className="text-text mb-2">4. Payment</h3>
          <p>We accept Mobile Money (MTN, Airtel), Visa/Mastercard, and gift cards. All transactions are processed securely through our payment partners. Prices include applicable taxes.</p>
        </section>

        <section>
          <h3 className="text-text mb-2">5. Delivery</h3>
          <p>Delivery times vary by location. Kampala: 1-2 business days. Other cities: 2-5 business days. Pickup points are available for discreet collection. See our shipping policy for full details.</p>
        </section>

        <section>
          <h3 className="text-text mb-2">6. Returns & Refunds</h3>
          <p>Due to the intimate nature of our products, returns are accepted only for unopened, sealed items within 7 days of delivery. Defective products are eligible for replacement or refund. See our returns policy for details.</p>
        </section>

        <section>
          <h3 className="text-text mb-2">7. Intellectual Property</h3>
          <p>All content on this site (images, text, logos, design) is owned by PleasureZone Uganda and may not be reproduced without permission.</p>
        </section>

        <section>
          <h3 className="text-text mb-2">8. Limitation of Liability</h3>
          <p>PleasureZone Uganda is not liable for any indirect, incidental, or consequential damages arising from the use of our products or services. Our total liability is limited to the amount paid for the specific order in question.</p>
        </section>

        <section>
          <h3 className="text-text mb-2">9. Contact</h3>
          <p>Questions about these terms? Contact us at <a href="mailto:legal@pleasurezone.ug" className="link">legal@pleasurezone.ug</a>.</p>
        </section>
      </div>
    </div>
  );
}
