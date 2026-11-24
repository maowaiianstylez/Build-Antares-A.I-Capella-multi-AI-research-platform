import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { PLANS, formatPrice } from "@/lib/plans";
import { COMPANY, PRODUCT } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of Service · Rehua A.I Capella" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms are an agreement between you and {COMPANY} (&ldquo;Rehua&rdquo;, &ldquo;we&rdquo;) for using{" "}
        {PRODUCT} on the web and in our apps. By creating an account or using Rehua, you agree to them and to our{" "}
        <Link href="/privacy">Privacy Policy</Link>. If you don&rsquo;t agree, please don&rsquo;t use Rehua.
      </p>

      <h2>Who can use Rehua</h2>
      <p>
        You must be at least 13 years old. If you are under 18, you need a parent or guardian&rsquo;s permission, and
        they agree to these terms for you. You&rsquo;re responsible for keeping your password safe and for what happens
        on your account.
      </p>

      <h2 id="ai">AI answers and acceptable use</h2>
      <p>
        Rehua sends your questions to AI models from several companies and combines their answers with web sources.
        AI can be wrong, out of date, incomplete, or biased, even when it sounds confident and cites sources.
      </p>
      <ul>
        <li>
          <strong>Check before you rely on it.</strong> Rehua is not a doctor, lawyer, financial advisor or emergency
          service. Don&rsquo;t use it as the only basis for medical, legal, financial, safety or other important
          decisions. In an emergency, call your local emergency number.
        </li>
        <li>
          <strong>Report bad answers.</strong> Tap &ldquo;Report&rdquo; under any answer that is harmful, offensive or
          seriously wrong. We review reports and use them to improve Rehua&rsquo;s safeguards.
        </li>
        <li>
          <strong>Don&rsquo;t use Rehua to:</strong> break the law; harm, harass, threaten or exploit anyone; create
          sexual content involving minors; get help making weapons capable of mass harm; spread malware or attack
          computer systems; deceive people with impersonation or fraud; violate others&rsquo; privacy or intellectual
          property; or try to get around our safeguards, limits or the AI providers&rsquo; usage policies.
        </li>
        <li>
          <strong>Your content.</strong> You keep ownership of what you type. You give us permission to process it to
          run Rehua as described in the Privacy Policy. As between you and us, you own the answers you receive, subject
          to the AI providers&rsquo; terms, but similar answers may be given to other people.
        </li>
      </ul>
      <p>We may suspend or close accounts that break these rules.</p>

      <h2 id="billing">Plans, billing and cancellation</h2>
      <ul>
        <li>
          {PLANS.free.name} is free with a daily message limit. {PLANS.pro.name} ({formatPrice(PLANS.pro.priceCents)}
          /month) and {PLANS.max.name} ({formatPrice(PLANS.max.priceCents)}/month) add more messages and features, as
          described on the <Link href="/pricing">pricing page</Link>.
        </li>
        <li>
          Paid plans are monthly subscriptions that <strong>renew automatically</strong> and are charged to your payment
          method each month until you cancel.
        </li>
        <li>
          Cancel any time from your <Link href="/account">account page</Link> (&ldquo;Manage billing&rdquo;). You keep
          your plan until the end of the period you paid for. Deleting your account cancels the subscription
          immediately.
        </li>
        <li>
          Payments are processed by Stripe. Unless the law requires otherwise, payments are non-refundable, but contact{" "}
          <Link href="/support">support</Link> if something went wrong and we&rsquo;ll make it right.
        </li>
        <li>
          If we change a price, we&rsquo;ll tell you at least 30 days in advance, and it applies from your next billing
          period. Taxes may be added where required.
        </li>
      </ul>

      <h2>The service</h2>
      <p>
        We work to keep Rehua available and accurate, but it&rsquo;s provided &ldquo;as is&rdquo; and &ldquo;as
        available&rdquo;. Features, AI models and providers may change, and the service may sometimes be interrupted.
        We may update these terms; if a change is significant, we&rsquo;ll tell you in the app or by email before it
        takes effect, and continuing to use Rehua means you accept it.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can delete your account any time from the <Link href="/account">account page</Link>. We may suspend or end
        access if you break these terms or the law, or if we stop offering Rehua (with notice and a pro-rated refund of
        any prepaid period in that case).
      </p>

      <h2>Limits of our liability</h2>
      <p>
        To the fullest extent the law allows, Rehua and its team are not liable for indirect, incidental, special,
        consequential or punitive damages, or for decisions you make based on AI answers. Our total liability for any
        claim is limited to the greater of the amount you paid us in the 12 months before the claim or US$100. Some
        places don&rsquo;t allow these limits, so they may not fully apply to you.
      </p>

      <h2>Disputes</h2>
      <p>
        Please contact us first; most problems can be solved quickly. These terms are governed by the laws of the
        United States and the state where {COMPANY} is organized, without regard to conflict-of-law rules. Nothing here
        takes away rights you have under the consumer protection laws of where you live.
      </p>

      <h2>App stores</h2>
      <p>
        If you downloaded Rehua from the Apple App Store or Google Play, these terms are between you and {COMPANY}, not
        Apple or Google. Apple and Google aren&rsquo;t responsible for the app or its content, have no obligation to
        provide support for it, and are third-party beneficiaries of these terms who may enforce them. Your use must
        also follow the store&rsquo;s own terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Visit our <Link href="/support">support page</Link>.
      </p>
    </LegalPage>
  );
}
