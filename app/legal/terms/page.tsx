import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { missing, SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of Service - Sponty" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms are an agreement between you and {missing(SITE.operator, "operator name")} for using {SITE.name}. By
        using {SITE.name} you accept them, along with the <Link href="/legal/privacy">Privacy Policy</Link>.
      </p>

      <h2>Who can use Sponty</h2>
      <p>You must be at least {SITE.minimumAge} years old.</p>

      <h2>Price</h2>
      <p>
        {SITE.name} is free. There are no subscriptions, in-app purchases, or hidden fees. If we ever add paid features, we
        will show the full price before you pay and our <Link href="/legal/refunds">Refund Policy</Link> will apply.
      </p>

      <h2>Your content</h2>
      <p>
        You keep ownership of the posts, photos, and reviews you share. You give us permission to store and display them
        inside {SITE.name} so the app can work. You can delete them at any time.
      </p>
      <p>Only share content you have the right to share, and don&apos;t post other people&apos;s private information.</p>

      <h2>Honest reviews</h2>
      <ul>
        <li>Only review places you have actually been to.</li>
        <li>Don&apos;t post reviews in exchange for payment, free items, or other rewards without saying so.</li>
        <li>Don&apos;t review your own business or a competitor&apos;s.</li>
        <li>Don&apos;t post the same review many times or from several accounts.</li>
      </ul>
      <p>We may hide or remove reviews that break these rules, and you can report a review you think is fake.</p>

      <h2>What&apos;s not allowed</h2>
      <ul>
        <li>Harassment, hate, threats, or sexual content involving minors.</li>
        <li>Spam, scams, or impersonating someone else.</li>
        <li>Attempts to break, overload, or scrape the service.</li>
      </ul>

      <h2>AI suggestions</h2>
      <p>
        Friend suggestions and match scores are automated guesses based on profiles. They can be wrong, and they say
        nothing about whether a person is safe to meet. Use your judgement when meeting anyone in person.
      </p>

      <h2>Places and reviews</h2>
      <p>
        Reviews are opinions from other users. Check opening hours, safety, and access yourself before you go.
      </p>

      <h2>No warranty</h2>
      <p>
        {SITE.name} is provided as it is. To the extent the law allows, we are not liable for indirect losses from using
        it. Nothing in these terms limits rights you have under consumer protection law.
      </p>

      <h2>Ending your use</h2>
      <p>
        You can stop using {SITE.name} and <Link href="/about#delete">delete your data</Link> at any time. We may suspend
        accounts that break these terms.
      </p>

      <h2>Law and contact</h2>
      <p>
        These terms are governed by the laws of {SITE.jurisdiction}. Questions: {missing(SITE.contactEmail, "contact email")}
        .
      </p>
    </LegalPage>
  );
}
