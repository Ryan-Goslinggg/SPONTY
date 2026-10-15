# Third-party services and licenses

This is the audit of every outside service and asset Sponty uses: what data reaches it, and under what license.
Re-check this list whenever a dependency or service is added.

## Services that receive user data

| Service | Used for | What it receives | When | Policy |
| --- | --- | --- | --- | --- |
| Esri World Imagery | Satellite map tiles | IP address, map area being viewed | Opening Find | [Esri terms](https://www.esri.com/en-us/legal/terms/full-master-agreement) |
| OpenStreetMap Nominatim | Place search, reverse geocoding | IP address, search text, coordinates when using "Here" | Searching or locating | [OSMF privacy](https://osmfoundation.org/wiki/Privacy_Policy) |
| Anthropic (Claude API) | AI friend matching | Name, bio, hobbies, area of the user and candidates | Only with AI matching on and an API key set | [Anthropic privacy](https://www.anthropic.com/legal/privacy) |
| Vercel | Hosting | IP address and request logs | Every visit | [Vercel privacy](https://vercel.com/legal/privacy-policy) |
| Picsum Photos | Demo photos | IP address | Viewing demo posts | [Unsplash license](https://unsplash.com/license) |

Not used: analytics, ad networks, social login SDKs, crash reporters, or tracking pixels.
The Nunito font is downloaded at build time by `next/font` and served from Sponty's own domain, so Google never sees visitors.

### Usage limits to respect

- **Nominatim** allows at most 1 request per second and no heavy use.
  Search is debounced by 450 ms.
  For real traffic, switch to a paid geocoder or self-host Nominatim.
- **Esri World Imagery** needs the on-map attribution, which is shown.
  Check Esri's terms for commercial use at scale.

## Attribution shown in the app

- Map: "Imagery © Esri, Maxar, Earthstar Geographics" plus the Leaflet credit, at the bottom of the map.
- Search results: "Search data © OpenStreetMap contributors" (ODbL 1.0).
- Everything is listed on the `/about` page.

## Assets and code licenses

| Item | License | Notes |
| --- | --- | --- |
| Nunito font | SIL Open Font License 1.1 | Free for commercial use |
| Demo photos (Picsum, from Unsplash) | Unsplash License | Free to use. Replace them with real user content before launch |
| Icons | Original | Drawn as inline SVG for Sponty |
| Leaflet | BSD 2-Clause | |
| React Leaflet | Hippocratic License 2.1 | Not an OSI license: it forbids uses that violate human rights. Fine for Sponty, but note it if the app is sold or licensed |
| Next.js, React, Tailwind CSS, Zod, Anthropic SDK | MIT | |

To re-check dependency licenses:

```bash
npx license-checker --summary
```
