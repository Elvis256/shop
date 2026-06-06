"use client";

export default function PrivacyPage() {
  return (
    <div className="container py-12 max-w-3xl">
      <h1 className="mb-8">Privacy Policy</h1>

      <div className="space-y-6 text-text-muted leading-relaxed">
        <p className="text-text font-medium">Last updated: June 2026</p>

        <section>
          <h3 className="text-text mb-2">1. Information We Collect</h3>
          <p>We collect information you provide when creating an account, placing orders, or contacting us. This includes your name, email, phone number, delivery address, and payment details. We also collect browsing data and device information to improve your experience.</p>
        </section>

        <section>
          <h3 className="text-text mb-2">2. How We Use Your Information</h3>
          <p>Your information is used to process orders, provide customer support, send order updates (including via WhatsApp if opted in), personalize your shopping experience, and prevent fraud. We never sell your personal data to third parties.</p>
        </section>

        <section>
          <h3 className="text-text mb-2">3. Discreet Shopping</h3>
          <p>We understand the importance of privacy. All orders are shipped in plain, unmarked packaging with no indication of contents. Your bank statement will show a generic business name. Our discreet mode feature allows you to browse privately.</p>
        </section>

        <section>
          <h3 className="text-text mb-2">4. Data Security</h3>
          <p>We use industry-standard encryption (SSL/TLS) to protect your data in transit. Payment processing is handled by secure third-party providers (Stripe, Mobile Money). We never store your full payment card details on our servers.</p>
        </section>

        <section>
          <h3 className="text-text mb-2">5. Cookies</h3>
          <p>We use essential cookies for site functionality (cart, authentication), analytics cookies to understand usage patterns, and preference cookies to remember your settings (theme, currency, language).</p>
        </section>

        <section>
          <h3 className="text-text mb-2">6. Your Rights</h3>
          <p>You can access, update, or delete your personal data at any time through your account settings. To request full data deletion, contact us at privacy@pleasurezone.ug. We will respond within 30 days.</p>
        </section>

        <section>
          <h3 className="text-text mb-2">7. Contact</h3>
          <p>For privacy-related inquiries, email us at <a href="mailto:privacy@pleasurezone.ug" className="link">privacy@pleasurezone.ug</a> or use our live chat.</p>
        </section>
      </div>
    </div>
  );
}
