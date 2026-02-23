export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-accent text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
          <p className="text-white/80">Last updated: February 2026</p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-xl p-8 prose prose-gray max-w-none">
          <h2>1. Agreement to Terms</h2>
          <p>
            By accessing or using Adult Store's website and services, you agree to be bound 
            by these Terms of Service. If you do not agree to these terms, please do not 
            use our services.
          </p>

          <h2>2. Age Requirement</h2>
          <p>
            <strong>You must be at least 18 years old (or the age of majority in your jurisdiction) 
            to use this website and purchase products.</strong> By using our services, you 
            represent and warrant that you meet this age requirement.
          </p>

          <h2>3. Account Registration</h2>
          <p>To make purchases, you may need to create an account. You agree to:</p>
          <ul>
            <li>Provide accurate and complete information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Accept responsibility for all activities under your account</li>
            <li>Notify us immediately of any unauthorized access</li>
          </ul>

          <h2>4. Products and Pricing</h2>
          <ul>
            <li>All prices are displayed in Ugandan Shillings (UGX) unless otherwise stated</li>
            <li>Prices may change without notice</li>
            <li>We reserve the right to correct pricing errors</li>
            <li>Product images are for illustration; actual products may vary slightly</li>
            <li>Product availability is subject to change</li>
          </ul>

          <h2>5. Orders and Payment</h2>
          <ul>
            <li>Placing an order constitutes an offer to purchase</li>
            <li>We reserve the right to refuse or cancel any order</li>
            <li>Payment must be completed before order processing</li>
            <li>You are responsible for providing accurate shipping information</li>
          </ul>

          <h2>6. Shipping and Delivery</h2>
          <ul>
            <li>Delivery times are estimates and not guaranteed</li>
            <li>Risk of loss passes to you upon delivery to the carrier</li>
            <li>We are not responsible for delays caused by carriers or customs</li>
            <li>Incorrect addresses may result in additional charges</li>
          </ul>

          <h2>7. Returns and Refunds</h2>
          <p>
            Our return policy is detailed on our Shipping & Returns page. Key points:
          </p>
          <ul>
            <li>Returns accepted within 14 days for eligible items</li>
            <li>Items must be unopened and in original packaging</li>
            <li>Certain items are non-returnable for hygiene reasons</li>
            <li>Refunds processed to original payment method</li>
          </ul>

          <h2>8. Intellectual Property</h2>
          <p>
            All content on this website, including text, images, logos, and software, 
            is our property or licensed to us. You may not:
          </p>
          <ul>
            <li>Copy, modify, or distribute our content without permission</li>
            <li>Use our trademarks without authorization</li>
            <li>Scrape or extract data from our website</li>
          </ul>

          <h2>9. Prohibited Activities</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the site for any illegal purpose</li>
            <li>Attempt to gain unauthorized access to our systems</li>
            <li>Interfere with site functionality</li>
            <li>Submit false or misleading information</li>
            <li>Resell products without authorization</li>
            <li>Harass our staff or other customers</li>
          </ul>

          <h2>10. Disclaimer of Warranties</h2>
          <p>
            Products are provided "as is" without warranties beyond those from manufacturers. 
            We are not responsible for product misuse or failure to follow instructions.
          </p>

          <h2>11. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, we shall not be liable for any 
            indirect, incidental, special, or consequential damages arising from your 
            use of our services or products.
          </p>

          <h2>12. Indemnification</h2>
          <p>
            You agree to indemnify and hold us harmless from any claims, damages, or 
            expenses arising from your violation of these terms or misuse of our services.
          </p>

          <h2>13. Governing Law</h2>
          <p>
            These terms are governed by the laws of Uganda. Any disputes shall be 
            resolved in the courts of Kampala, Uganda.
          </p>

          <h2>14. Changes to Terms</h2>
          <p>
            We may update these terms at any time. Continued use of our services 
            after changes constitutes acceptance of the new terms.
          </p>

          <h2>15. Contact Information</h2>
          <p>For questions about these terms:</p>
          <ul>
            <li>Email: legal@adultstore.com</li>
            <li>Phone: +254 700 000 000</li>
          </ul>

          <h2>16. Severability</h2>
          <p>
            If any provision of these terms is found unenforceable, the remaining 
            provisions will continue in effect.
          </p>
        </div>
      </div>
    </div>
  );
}
