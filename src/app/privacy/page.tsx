import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { COMPANY, PRODUCT, supportEmail } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy Policy · Rehua A.I Capella" };

export default function PrivacyPage() {
  const email = supportEmail();
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains what {COMPANY} (&ldquo;Rehua&rdquo;, &ldquo;we&rdquo;) collects when you use {PRODUCT} on
        the web or in our iPhone, iPad and Android apps, why, who we share it with, and the choices you have. The short
        version: we collect what we need to run your account and answer your questions, we never sell your data, and you
        can delete everything at any time from inside the app.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your name, email address, and your password (stored only as a one-way
          scrambled hash we can&rsquo;t read).
        </li>
        <li>
          <strong>Your conversations:</strong> the questions you ask, the answers, the sources cited, which AI model
          answered, and which kind of device sent each message (for example &ldquo;Phone&rdquo; or
          &ldquo;Computer&rdquo;). We keep these so they sync across your devices.
        </li>
        <li>
          <strong>Usage counts:</strong> how many messages you&rsquo;ve sent today, to apply your plan&rsquo;s daily
          limit.
        </li>
        <li>
          <strong>Payment records:</strong> if you subscribe, Stripe handles your card. We store only your Stripe
          customer and subscription IDs and your plan status. We never see or store your card number.
        </li>
        <li>
          <strong>Notification tokens:</strong> if you allow notifications in the app, a device token from Apple or
          Google so we can tell you when a long answer is ready.
        </li>
        <li>
          <strong>Security data:</strong> your IP address, briefly, to limit repeated sign-in attempts and stop abuse.
        </li>
        <li>
          <strong>Reports and support requests:</strong> if you flag an answer or contact support, what you send us.
        </li>
      </ul>
      <p>
        We do not collect your location, contacts, photos, or advertising identifiers. We do not use third-party
        advertising or tracking, and we do not track you across other apps or websites.
      </p>

      <h2>Voice</h2>
      <p>
        When you use the microphone, your speech is turned into text by your device&rsquo;s own speech service (Apple on
        iPhone and iPad, Google on Android, or your web browser&rsquo;s engine). Only the resulting text is sent to Rehua.
        We don&rsquo;t record or store audio. &ldquo;Read aloud&rdquo; uses your device&rsquo;s built-in voice.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To answer your questions and sync your conversations across your devices.</li>
        <li>To run your account, apply plan limits, and process subscriptions.</li>
        <li>To send account emails such as password resets, and app notifications you&rsquo;ve allowed.</li>
        <li>To keep Rehua secure, prevent abuse, and review answers people report.</li>
      </ul>
      <p>We do not use your conversations to train our own AI models, and we do not sell or rent your data.</p>

      <h2>AI providers that process your questions</h2>
      <p>
        To answer, Rehua sends your question and the relevant conversation history to one or more AI providers. Which
        ones depends on the model you pick, Rehua Auto&rsquo;s routing, or Deep Dive, which asks several at once:
      </p>
      <ul>
        <li>Anthropic (Claude), United States</li>
        <li>OpenAI (ChatGPT), United States</li>
        <li>Google (Gemini), United States</li>
        <li>xAI (Grok), United States</li>
        <li>
          DeepSeek and Moonshot AI (Kimi), China. These are used <strong>only</strong> when you choose them by hand.
          They are labeled in the model picker, and Rehua Auto never sends your questions to them.
        </li>
      </ul>
      <p>
        We use these providers&rsquo; business APIs. Each processes your request under its own terms and privacy
        policy, and their business terms generally do not allow them to train on API data. Please don&rsquo;t share
        information in a question that you wouldn&rsquo;t want an AI provider to process.
      </p>

      <h2>Other service providers</h2>
      <ul>
        <li>Railway, which hosts our servers and database in the United States.</li>
        <li>Stripe, for payments.</li>
        <li>Resend, for account emails.</li>
        <li>Apple Push Notification service and Google Firebase Cloud Messaging, for app notifications.</li>
      </ul>
      <p>
        We may also disclose information if the law requires it, to protect people from harm, or as part of a merger or
        sale of the business (in which case this policy continues to apply).
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account and conversations until you delete them. Deleting a conversation removes it from every
        device. Deleting your account removes your account, all conversations and your notification tokens right away;
        copies in encrypted backups expire within 30 days. Stripe keeps payment records as tax law requires. Reports
        you&rsquo;ve made are kept without any link to your account.
      </p>

      <h2 id="delete">Your choices and rights</h2>
      <ul>
        <li>
          <strong>Delete your account:</strong> in the app or on the web, open{" "}
          <Link href="/account">Account</Link> and choose &ldquo;Delete my account&rdquo;. If you can&rsquo;t sign in,
          use the <Link href="/support#delete">support page</Link>.
        </li>
        <li>
          <strong>See or correct your data:</strong> your conversations are always visible in the app. Contact us for a
          copy of everything we hold about you.
        </li>
        <li>Turn off notifications any time in your device settings.</li>
      </ul>
      <p>
        Depending on where you live (for example California, Colorado, Virginia, the EU or the UK), you may have rights
        to access, correct, delete or port your data, and to object to or limit some processing. We honor these
        requests for everyone, wherever you live, and won&rsquo;t treat you differently for using them.
      </p>

      <h2>Children</h2>
      <p>
        Rehua is not for children under 13, and we don&rsquo;t knowingly collect their information. Teens under 18
        should use Rehua with a parent or guardian&rsquo;s permission. If you believe a child under 13 has an account,
        contact us and we&rsquo;ll delete it.
      </p>

      <h2>Security</h2>
      <p>
        Connections are encrypted with HTTPS, passwords are hashed, sign-in sessions are stored in secure cookies, and
        access to production data is limited. No system is perfectly secure, so we&rsquo;ll notify you as the law
        requires if a breach affects your data.
      </p>

      <h2>Changes</h2>
      <p>
        If we make a significant change, we&rsquo;ll update the date above and tell you in the app or by email before it
        takes effect.
      </p>

      <h2>Contact</h2>
      <p>
        {COMPANY}
        <br />
        {email ? (
          <>
            Email: <a href={`mailto:${email}`}>{email}</a>
            <br />
          </>
        ) : null}
        Or use the form on our <Link href="/support">support page</Link>.
      </p>
    </LegalPage>
  );
}
