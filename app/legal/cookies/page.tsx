import type { Metadata } from "next";
import { CookieChoiceReset } from "@/components/CookieNotice";
import { LegalPage } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Cookie Policy - Sponty" };

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy">
      <p>
        {SITE.name} does not use advertising or analytics cookies, and it does not track you across other websites.
      </p>

      <h2>What we store on your device</h2>
      <p>
        We store only what the app needs to work:
      </p>
      <ul>
        <li>
          <strong>A sign-in cookie</strong> that keeps you logged in for up to 30 days. It is secure, HTTP-only (scripts
          can&apos;t read it), and removed when you sign out.
        </li>
        <li>
          <strong>Your choices</strong> in local storage (age and Terms confirmation, cookie notice, reviews you
          reported). They are needed so we don&apos;t ask again.
        </li>
      </ul>
      <p>These are strictly necessary, so they don&apos;t need consent, but we tell you about them in the cookie notice.</p>

      <h2>Third parties</h2>
      <p>
        The map (Esri), place search (OpenStreetMap Nominatim), and demo photos (Picsum) load from other servers. They
        receive your IP address but set no cookies through {SITE.name}. Our font is served from our own server, not
        Google.
      </p>

      <h2>Your choice</h2>
      <p>
        You can clear stored data at any time in your browser settings, or with Delete my data on the About page. To see
        the cookie notice again, use the button below.
      </p>
      <CookieChoiceReset />
    </LegalPage>
  );
}
