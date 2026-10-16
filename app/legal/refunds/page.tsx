import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { missing, SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Refund Policy - Sponty" };

export default function RefundsPage() {
  return (
    <LegalPage title="Refund Policy">
      <p>
        {SITE.name} is completely free. Nothing in the app costs money, so there is nothing to refund and no fee that can
        appear later.
      </p>

      <h2>If paid features are added</h2>
      <ul>
        <li>The full price, including taxes, will be shown before you pay. There will be no hidden or surprise fees.</li>
        <li>Any subscription will be as easy to cancel as it was to start, and will say clearly when it renews.</li>
        <li>
          You can ask for a full refund within 14 days of a purchase. Refunds will go back to the original payment method.
        </li>
        <li>This policy will be updated, with a new date, before any paid feature launches.</li>
      </ul>

      <h2>Contact</h2>
      <p>Questions about payments: {missing(SITE.contactEmail, "contact email")}.</p>
    </LegalPage>
  );
}
