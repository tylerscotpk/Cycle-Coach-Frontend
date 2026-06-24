import InfoNav from '@/components/InfoNav';

const InfoPrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-slate-950">
      <InfoNav />
      
      <section className="relative pt-32 pb-16 px-6">
        <div className="relative z-10 max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>
          <p className="text-slate-400 text-sm mb-8">Last updated: June 2026</p>

          <div className="space-y-8 text-slate-300 text-sm leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">1. Overview</h2>
              <p>
                Cycle Coach is a relationship tool built by Stars &amp; Honey, LLC that helps men understand and support their partners through menstrual cycle tracking. We are committed to protecting your privacy and being transparent about how we handle data.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">2. Data We Collect</h2>
              <h3 className="text-white font-medium mt-4 mb-2">Account Data (stored on our servers):</h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Email address (for authentication and account recovery)</li>
                <li>Phone number (optional, for login)</li>
                <li>Hashed password (we never store plaintext passwords)</li>
                <li>Subscription status and billing information (managed by Stripe)</li>
              </ul>

              <h3 className="text-white font-medium mt-4 mb-2">Cycle &amp; Personal Data (stored ONLY on your device):</h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Partner cycle dates and history</li>
                <li>Partner preferences and profile information</li>
                <li>Partner consent records</li>
                <li>Notification settings</li>
              </ul>
              <p className="mt-2 text-green-300">
                All sensitive cycle and relationship data is stored exclusively in your browser&apos;s local storage. It never leaves your device and is never sent to our servers.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">3. AI Wingman</h2>
              <p>
                If you use the AI Wingman feature, your messages are sent anonymously to OpenAI for processing. We do not store chat history on our servers. Do not share personally identifiable information in chat messages.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">4. Payment Processing</h2>
              <p>
                Payments are processed by Stripe. We do not store credit card numbers or payment details on our servers. Stripe&apos;s privacy policy applies to payment data.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">5. Cookies &amp; Authentication</h2>
              <p>
                We use session tokens for authentication. These are stored in your browser&apos;s local storage and are used solely to keep you logged in. We do not use tracking cookies or third-party analytics.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">6. Data Sharing</h2>
              <p>
                We do not sell, rent, or share your personal data with third parties. The only external services that receive data are:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                <li><strong className="text-white">Stripe</strong> — for payment processing</li>
                <li><strong className="text-white">OpenAI</strong> — for AI Wingman chat (anonymous, no stored history)</li>
                <li><strong className="text-white">Resend</strong> — for transactional emails (welcome, purchase confirmation)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">7. Data Deletion</h2>
              <p>
                You can delete all locally stored data at any time from the Privacy &amp; Data settings page within the app. To delete your account and server-side data, contact us at cyclecoach4men@gmail.com.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">8. Partner Consent</h2>
              <p>
                Cycle Coach requires you to confirm that your partner has given explicit consent before you track their cycle data. Tracking someone&apos;s reproductive health data without their knowledge or consent is a violation of privacy and trust.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">9. Legal Considerations</h2>
              <p>
                Reproductive health data may be subject to legal subpoena in certain jurisdictions. While Cycle Coach stores this data only on your device (not on our servers), users should be aware of the legal landscape in their region regarding reproductive health data.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">10. Children&apos;s Privacy</h2>
              <p>
                Cycle Coach is not intended for use by individuals under the age of 18. We do not knowingly collect data from minors.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">11. Changes to This Policy</h2>
              <p>
                We may update this privacy policy from time to time. Continued use of the app after changes constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">12. Contact</h2>
              <p>
                For privacy questions or data deletion requests, contact us at:
              </p>
              <p className="mt-2">
                <a href="mailto:cyclecoach4men@gmail.com" className="text-cyan-400 hover:text-cyan-300">cyclecoach4men@gmail.com</a>
              </p>
              <p className="mt-1 text-slate-400">Stars &amp; Honey, LLC</p>
            </section>
          </div>
        </div>
      </section>

      <footer className="py-12 px-6 border-t border-slate-800/50 mt-auto">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} Stars &amp; Honey, LLC. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default InfoPrivacyPolicy;
