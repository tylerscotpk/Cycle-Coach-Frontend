import InfoNav from '@/components/InfoNav';
import { Link } from 'react-router-dom';

const InfoTermsOfService = () => {
  return (
    <div className="min-h-screen ">
      <InfoNav />
      
      <section className="relative pt-32 pb-16 px-6">
        <div className="relative z-10 max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-8">Terms of Service</h1>
          <p className="text-slate-400 text-sm mb-8">Last updated: August 2026</p>

          <div className="space-y-8 text-slate-300 text-sm leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
              <p>
                By creating an account or using Cycle Coach (&ldquo;the Service&rdquo;), operated by Stars &amp; Honey, LLC (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree, do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">2. Age Requirement</h2>
              <p>
                You must be at least <strong className="text-white">18 years of age</strong> to create an account and use the Service. By registering, you represent and warrant that you are 18 or older. If we learn that a user is under 18, we will terminate the account immediately.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">3. Account Registration</h2>
              <p>
                You agree to provide accurate, complete information when creating your account and to keep it up to date. You are responsible for safeguarding your password and for all activities under your account. Notify us immediately at <a href="mailto:support@cyclecoach.net" className="text-cyan-400 hover:underline">support@cyclecoach.net</a> if you suspect unauthorized access.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">4. Acceptable Use</h2>
              <p className="mb-3">You agree not to:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Use the Service to stalk, harass, or monitor another person without their knowledge and consent</li>
                <li>Share, redistribute, or resell content, data, or features obtained through the Service</li>
                <li>Attempt to reverse-engineer, decompile, or extract source code from the Service</li>
                <li>Interfere with or disrupt the Service&apos;s infrastructure, servers, or networks</li>
                <li>Use automated systems (bots, scrapers) to access the Service without written permission</li>
                <li>Impersonate another person or misrepresent your identity</li>
                <li>Use the Service for any unlawful purpose or in violation of any applicable law</li>
              </ul>
              <p className="mt-3">
                Cycle Coach is designed as a relationship tool to help partners communicate and plan together. It should only be used with the knowledge and consent of the partner whose cycle information is being tracked.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">5. Subscription &amp; Billing</h2>
              <p className="mb-3">
                Cycle Coach offers subscription plans billed on a recurring basis through Stripe. By subscribing, you agree to the following:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong className="text-white">Free Trial:</strong> New accounts receive a 7-day free trial with full access. After the trial, you will be automatically enrolled in the Basic plan at $5/month unless you upgrade or cancel.</li>
                <li><strong className="text-white">Basic Plan:</strong> $5/month &mdash; core cycle tracking, phase reminders, and coaching content.</li>
                <li><strong className="text-white">Advanced Plan:</strong> $8/month &mdash; everything in Basic plus AI Wingman and personalized tips.</li>
                <li><strong className="text-white">Automatic Renewal:</strong> Subscriptions renew automatically at the end of each billing period. You will be charged the applicable rate unless you cancel before the renewal date.</li>
                <li><strong className="text-white">Cancellation:</strong> You may cancel at any time from your Account Settings. Cancellation takes effect at the end of the current billing period &mdash; you retain access until then. No partial refunds are issued for unused time.</li>
                <li><strong className="text-white">Price Changes:</strong> We may change subscription prices with at least 30 days&apos; notice. Continued use after a price change constitutes acceptance.</li>
              </ul>
              <p className="mt-3">
                All payment processing is handled by <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Stripe</a>. We do not store your credit card details.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">6. Data Usage &amp; Privacy</h2>
              <p className="mb-3">
                Your use of the Service is also governed by our <Link to="/privacy-policy" className="text-cyan-400 hover:underline">Privacy Policy</Link>, which describes how we collect, use, and protect your data.
              </p>
              <p className="mb-3">Key points:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Cycle data, partner profiles, and personal tracking information are stored locally on your device &mdash; not on our servers.</li>
                <li>Account data (email, subscription status) is stored securely on our servers.</li>
                <li>AI Wingman conversations are processed by third-party AI providers and are not stored or used for training.</li>
                <li>We do not sell, share, or monetize your personal data.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">7. Disclaimer of Medical Advice</h2>
              <p className="mb-3">
                <strong className="text-white">Cycle Coach is NOT a medical device, diagnostic tool, or substitute for professional medical advice.</strong>
              </p>
              <p className="mb-3">
                The Service provides general wellness information based on statistical models of the menstrual cycle. Phase predictions, day estimates, and coaching tips are approximations and should not be relied upon for:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Medical diagnosis or treatment</li>
                <li>Contraception or family planning</li>
                <li>Detection of pregnancy, menopause, or medical conditions</li>
                <li>Any health decisions that require professional medical guidance</li>
              </ul>
              <p className="mt-3">
                If you or your partner have concerns about menstrual health, cycle irregularities, or reproductive health, consult a qualified healthcare professional. Always seek professional advice for medical questions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">8. Intellectual Property</h2>
              <p>
                All content, features, design, text, graphics, and software comprising the Service are owned by Stars &amp; Honey, LLC and are protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or create derivative works without our express written permission.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">9. Limitation of Liability</h2>
              <p className="mb-3">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, STARS &amp; HONEY, LLC AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Your use of or inability to use the Service</li>
                <li>Any inaccuracies in cycle predictions, phase calculations, or AI-generated advice</li>
                <li>Decisions made based on information provided by the Service</li>
                <li>Unauthorized access to your account or data</li>
                <li>Service interruptions, bugs, or errors</li>
              </ul>
              <p className="mt-3">
                Our total liability for any claim arising from the Service shall not exceed the amount you paid us in the 12 months preceding the claim, or $50, whichever is greater.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">10. Termination</h2>
              <p>
                We reserve the right to suspend or terminate your account at any time for violation of these Terms or for any other reason at our sole discretion. You may delete your account at any time from your Account Settings or by contacting us. Upon termination, your right to use the Service ceases immediately. Data stored locally on your device remains under your control.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">11. Changes to Terms</h2>
              <p>
                We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms on this page and updating the &ldquo;Last updated&rdquo; date. Continued use of the Service after changes constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">12. Governing Law</h2>
              <p>
                These Terms are governed by the laws of the State of Texas, United States, without regard to conflict of law principles. Any dispute arising from these Terms or the Service shall be resolved in the courts of Texas.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">13. Contact</h2>
              <p>
                Questions about these Terms? Contact us at{' '}
                <a href="mailto:support@cyclecoach.net" className="text-cyan-400 hover:underline">support@cyclecoach.net</a>{' '}
                or through the <Link to="/info/contact" className="text-cyan-400 hover:underline">Contact page</Link>.
              </p>
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

export default InfoTermsOfService;
