# Compliance checklist

This page tracks the 20-item launch checklist: what Sponty does for each item, and what still needs a person.
It is an engineering checklist, not legal advice.
Have a lawyer review the legal pages before a public launch, especially if you will operate outside the Philippines.

## Before launch: things only you can fill in

- [ ] Fill in `operator`, `contactEmail`, and `address` in `lib/site.ts`.
  Until then the legal and About pages show "[... not set yet]".
- [ ] Confirm `jurisdiction` and `minimumAge` in `lib/site.ts`.
- [ ] Register with the Philippines National Privacy Commission if your processing requires it.
- [ ] Have a lawyer review the Privacy Policy, Terms, Cookie Policy, and Refund Policy.

## The 20 items

| # | Item | Status | Where |
| --- | --- | --- | --- |
| 1 | Privacy policy | Done | `/legal/privacy` |
| 2 | Terms of service | Done | `/legal/terms` |
| 3 | Refund policy | Done (app is free, and the policy covers future paid features) | `/legal/refunds` |
| 4 | Cookie policy | Done | `/legal/cookies` |
| 5 | Cookie consent banner | Done, as a notice | `components/CookieNotice.tsx` |
| 6 | Check form consents | Done | Welcome gate, AI matching opt-in, notices on every public form |
| 7 | No unnecessary data | Done | See [Data minimization](#data-minimization) |
| 8 | Audit third-party SDKs | Done | [third-party-services.md](third-party-services.md) |
| 9 | Remove dark patterns | Done | See [Dark patterns](#dark-patterns) |
| 10 | Remove hidden fees | Done (nothing is paid) | Terms, Refund Policy |
| 11 | Remove fake reviews | Done | Demo labels, honest-review checkbox, one review per place, Report button |
| 12 | Remove unsupported claims | Done | See [Claims](#claims) |
| 13 | Accessibility alt text | Done | Post photos, upload previews, map pins |
| 14 | Fix color contrast | Done | Palette in `app/globals.css` meets WCAG AA |
| 15 | Keyboard navigation | Done | Skip link, focus rings, sheet focus trap, map controls |
| 16 | Add business details | Needs your details | `/about`, values in `lib/site.ts` |
| 17 | Age consent for kids' data | Done | Welcome gate (16+) |
| 18 | Unsubscribe link in emails | Not applicable yet | Sponty sends no marketing email |
| 19 | License fonts/images | Done | [third-party-services.md](third-party-services.md), `/about` |
| 20 | Data deletion request | Done | `/about#delete` and the contact email |

## Details

### Cookie notice

Sponty sets no advertising or analytics cookies.
It only uses browser storage that the app needs to work, which the law treats as strictly necessary.
So the notice has a single "Got it" button.
A "Reject" button that changed nothing would itself be misleading.
If you ever add analytics or ads, replace the notice with a real choice (Accept / Reject, equal weight, nothing pre-ticked) and load those scripts only after Accept.

### Consents

- **Welcome gate** (`components/WelcomeGate.tsx`): the user must confirm they are 16 or older and accept the Terms and Privacy Policy before any app data loads.
  Both boxes start unticked.
  "I'm under 16" leads to a page that stores nothing.
  The legal pages and `/about` stay readable without accepting.
- **AI matching** (`lib/consent.ts`): off by default.
  While it is off, friend suggestions are scored in the browser and no profile data is sent to `/api/match`.
  The user is offered it once, with "No thanks" and "Turn on" styled the same, and can change it at any time in their profile.
- **Public content notices**: the profile, trip composer, and review forms each say who will see the content.

### Data minimization

- Profile location is rounded to about 1 km (`coarsen` in `lib/privacy.ts`).
- Location is only read when the user taps "Here" or the locate button, never in the background.
- Uploaded photos are re-encoded in the browser, which strips EXIF metadata such as GPS position.
- Location and camera use a "soft ask" first (`components/PermissionProvider.tsx`): a screen explains why, and only "Allow" triggers the browser prompt.
  "Not now" is just as prominent, and a blocked permission shows how to turn it back on.
- The in-app camera (`components/CameraSheet.tsx`) stops its stream the moment it closes.
- `/api/match` gets only name, bio, hobbies, and area, and only for people who aren't friends yet.
- No analytics, ad SDKs, or fingerprinting.

### Dark patterns

- Consent buttons have equal visual weight, and nothing is pre-ticked.
- Deleting data takes two taps, as easy as anything else, with a clear "can't be undone" warning.
- The feed ends with "You're all caught up" instead of loading more forever.
- No fake urgency, countdowns, or confirm-shaming copy.

### Fake reviews

- Seeded example people, posts, and reviews carry a visible **demo** badge, and `/about` explains they are made up.
- Writing a review requires ticking "I've actually been here, and I'm not being paid or rewarded for this review."
- One review per place per person (`lib/reviews.ts`).
- Anyone can report a review, which hides it for them (`lib/reports.ts`).
  With a server, reports should also feed a moderation queue.
- The Terms ban fake, paid, and self-reviews.

### Claims

- Suggestions are labelled "Picked by AI" only when Claude actually scored them.
- The Terms say match scores are automated guesses and say nothing about whether someone is safe to meet.
- The privacy copy describes what actually happens and nothing more.

### Accessibility

- Text and controls meet WCAG AA contrast (4.5:1 for text, 3:1 for icons and stars).
- A "Skip to content" link appears on the first Tab press.
- A visible focus ring is shown on every interactive element.
- Sheets move focus inside, keep Tab inside while open, close on Escape, and return focus afterwards.
- The map can be used without a mouse: search, "locate me", and a "Drop pin at map center" button that appears when tabbed to.
  Review pins are focusable and labelled.
- Multi-photo posts are a scrollable region that works with arrow keys.
- Animations are turned off for people who prefer reduced motion.

### Emails

Sponty doesn't send marketing email.
Account emails such as sign-in links are transactional and don't need an unsubscribe link.
Any future marketing or digest email must include a one-click unsubscribe link and honor it right away.

### Data deletion

- **Self-service:** `/about#delete` has "Download my data" (JSON) and "Delete my data".
- **By request:** the Privacy Policy gives the contact email and promises an answer within 30 days.
- Once accounts and a server database exist, "Delete my data" must also delete the account and every server row it owns.
