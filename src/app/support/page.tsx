import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import SupportForm from "@/components/SupportForm";
import { supportEmail } from "@/lib/site";

export const metadata: Metadata = { title: "Support · Rehua A.I Capella" };

export default function SupportPage() {
  const email = supportEmail();
  return (
    <LegalPage title="Support" updated={false}>
      <p>
        We&rsquo;re here to help. Send us a message below
        {email ? (
          <>
            {" "}
            or email <a href={`mailto:${email}`}>{email}</a>
          </>
        ) : null}
        , and we&rsquo;ll reply by email, usually within 2 business days.
      </p>

      <div className="mt-6">
        <SupportForm />
      </div>

      <h2>Common questions</h2>
      <h3>How do I use Rehua on another device?</h3>
      <p>
        Sign in with the same email on every device, or open the chat menu and choose &ldquo;Link another
        device&rdquo; to get a 6-character code. Your conversations sync automatically.
      </p>
      <h3>What is Deep Dive?</h3>
      <p>
        On Pro and Max, Deep Dive asks every connected AI your question, checks their answers against real web sources
        and each other, and writes one answer showing where they agree and differ. Each Deep Dive counts as 5 messages.
      </p>
      <h3>How do I upgrade, change or cancel my plan?</h3>
      <p>
        Open <Link href="/account">Account</Link>. &ldquo;Upgrade&rdquo; shows the plans, and &ldquo;Manage
        billing&rdquo; lets you change cards, switch plans, see invoices or cancel. Cancelling keeps your plan until the
        end of the month you paid for.
      </p>
      <h3>An answer was wrong or harmful. What do I do?</h3>
      <p>
        Tap &ldquo;Report&rdquo; under the answer. Reports go straight to our review queue. AI can make mistakes, so
        please double-check anything important. See our <Link href="/terms#ai">AI policy</Link>.
      </p>
      <h3>The microphone doesn&rsquo;t work.</h3>
      <p>
        Allow microphone and speech recognition access for Rehua in your device&rsquo;s settings (on iPhone: Settings,
        Rehua). On the web, use Chrome, Edge or Safari.
      </p>

      <h2 id="delete">Deleting your account</h2>
      <p>
        Signed in? Open <Link href="/account">Account</Link> and choose &ldquo;Delete my account&rdquo;. It takes
        effect immediately, deletes every conversation on every device, and cancels any subscription. If you can&rsquo;t
        sign in, send the form above with the topic &ldquo;Delete my account&rdquo; from the email on your account and
        we&rsquo;ll confirm and delete it within 7 days. Details are in our <Link href="/privacy#delete">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
