import type { Metadata } from "next";
import Link from "next/link";
import { DataControls } from "@/components/DataControls";
import { LegalPage } from "@/components/LegalPage";
import { missing, SITE } from "@/lib/site";

export const metadata: Metadata = { title: "About - Sponty" };

const SERVICES = [
  {
    name: "Esri World Imagery",
    use: "Satellite map images",
    license: "Esri Terms of Use, attribution shown on the map",
    href: "https://www.esri.com/en-us/legal/terms/full-master-agreement",
  },
  {
    name: "OpenStreetMap Nominatim",
    use: "Place search. Data © OpenStreetMap contributors",
    license: "ODbL 1.0",
    href: "https://osmfoundation.org/wiki/Privacy_Policy",
  },
  {
    name: "Anthropic Claude",
    use: "Optional AI friend matching",
    license: "Anthropic Commercial Terms",
    href: "https://www.anthropic.com/legal/privacy",
  },
  {
    name: "Vercel",
    use: "Hosting",
    license: "Vercel Terms",
    href: "https://vercel.com/legal/privacy-policy",
  },
  {
    name: "Picsum Photos",
    use: "Demo photos (from Unsplash)",
    license: "Unsplash License",
    href: "https://unsplash.com/license",
  },
] as const;

const SOFTWARE = [
  { name: "Nunito font", license: "SIL Open Font License 1.1" },
  { name: "Leaflet", license: "BSD 2-Clause" },
  { name: "React Leaflet", license: "Hippocratic License 2.1" },
  { name: "Next.js, React, Tailwind CSS, Zod, Anthropic SDK", license: "MIT" },
  { name: "Icons", license: "Drawn for Sponty" },
] as const;

export default function AboutPage() {
  return (
    <LegalPage title="About">
      <p>
        {SITE.name} is a social app for sharing spontaneous trips and finding hidden-gem places, without endless scrolling.
        It is free to use.
      </p>

      <h2>Business details</h2>
      <ul>
        <li>Operator: {missing(SITE.operator, "operator name")}</li>
        <li>Contact: {missing(SITE.contactEmail, "contact email")}</li>
        <li>Address: {missing(SITE.address, "address")}</li>
      </ul>

      <h2 id="delete">Your data</h2>
      <p>
        Download a copy of everything {SITE.name} has stored about you, or delete it all. See the{" "}
        <Link href="/legal/privacy">Privacy Policy</Link> for details.
      </p>
      <div className="mt-3">
        <DataControls />
      </div>

      <h2>Demo content</h2>
      <p>
        The people, trips, and reviews you see marked &quot;demo&quot; are made up to show how {SITE.name} works. They are
        not real people or real reviews.
      </p>

      <h2 id="credits">Third-party services</h2>
      <ul>
        {SERVICES.map((s) => (
          <li key={s.name}>
            <strong>{s.name}</strong>: {s.use}. {s.license}.{" "}
            <a href={s.href} target="_blank" rel="noopener noreferrer">
              Their policy
            </a>
          </li>
        ))}
      </ul>

      <h2>Open source software</h2>
      <ul>
        {SOFTWARE.map((s) => (
          <li key={s.name}>
            {s.name}: {s.license}
          </li>
        ))}
      </ul>
    </LegalPage>
  );
}
