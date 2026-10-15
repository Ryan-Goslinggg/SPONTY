import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { missing, SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy Policy - Sponty" };

export default function PrivacyPage() {
  const email = missing(SITE.contactEmail, "contact email");
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains what {SITE.name} collects, why, who it is shared with, and how you can get it deleted.
        {SITE.name} is run by {missing(SITE.operator, "operator name")}.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Profile:</strong> your display name, bio, hobbies, and the area you say you are in.
        </li>
        <li>
          <strong>Content you share:</strong> trip posts and photos, likes, chat messages, and place reviews with the
          location you pinned them at.
        </li>
        <li>
          <strong>Location, only when you ask:</strong> when you tap &quot;Here&quot; or the locate button, your browser
          shares your position once. Your profile keeps it rounded to about 1 km. We never track you in the background.
        </li>
        <li>
          <strong>Your choices:</strong> whether you accepted the Terms, confirmed your age, allowed AI matching, and your
          cookie notice choice.
        </li>
      </ul>
      <p>
        Photos are re-encoded in your browser before they are saved. This removes hidden metadata such as the GPS position
        a camera may embed.
      </p>
      <p>We do not collect your contacts, payment details, or anything for advertising, and we do not sell data.</p>

      <h2>Where it is stored</h2>
      <p>
        Right now {SITE.name} keeps your data in your own browser&apos;s storage on this device. Clearing your browser data
        or using <Link href="/about#delete">Delete my data</Link> removes it.
      </p>

      <h2>Who else receives data</h2>
      <ul>
        <li>
          <strong>Esri</strong> provides the satellite map. Your browser requests map images from Esri, which sees your IP
          address and the area you are viewing.
        </li>
        <li>
          <strong>OpenStreetMap Nominatim</strong> turns place searches into map positions. It receives what you type in
          search and, when you use your location, the coordinates.
        </li>
        <li>
          <strong>Anthropic (Claude)</strong> scores friend suggestions, but only if you turn on AI matching. It then
          receives your bio, hobbies, and area, plus the same details of the people being compared. Anthropic does not use
          this data to train its models.
        </li>
        <li>
          <strong>Vercel</strong> hosts the app and keeps short-lived server logs, including IP addresses.
        </li>
        <li>
          <strong>Picsum Photos</strong> serves the demo photos, so it sees your IP address when they load.
        </li>
      </ul>
      <p>
        See <Link href="/about#credits">third-party services</Link> for links to their own privacy policies.
      </p>

      <h2>Why we use it</h2>
      <p>
        We use your data only to run the features you use: showing trips, chats, and reviews, and suggesting friends. Our
        legal basis is our agreement with you (the Terms), plus your consent for location and AI matching. You can withdraw
        consent at any time in your profile.
      </p>

      <h2>Children</h2>
      <p>
        {SITE.name} is for people aged {SITE.minimumAge} and over. We ask you to confirm your age before you start. If you
        believe a younger person has used it, contact us and we will delete their data.
      </p>

      <h2>Your rights</h2>
      <p>
        You can see and correct your data in your profile, download it, and delete it with{" "}
        <Link href="/about#delete">Delete my data</Link>. You can also email {email} to access, correct, or delete your
        data, or to object to how it is used. We answer within 30 days. You may also complain to your data protection
        authority (in the Philippines, the National Privacy Commission).
      </p>

      <h2>Changes</h2>
      <p>If we change this policy we will update the date above and, for important changes, tell you in the app.</p>
    </LegalPage>
  );
}
