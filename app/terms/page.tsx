import type { Metadata } from "next";
import { siteConfig } from "../../config/site";
import { PolicyPage } from "../components/policy-page";

export const metadata: Metadata = {
  title: "Terms",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <PolicyPage
      eyebrow="Terms of use"
      title="A discovery service, not a reservation."
      intro="Giveleaf helps people discover books recently listed by participating charity shops."
    >
      <section>
        <h2>Public catalogue</h2>
        <p>
          Inventory can change before a visitor reaches a shop. A listing does
          not reserve a book, guarantee its availability or create a contract
          of sale. Prices, condition, refunds and purchases are handled entirely
          by the participating charity shop.
        </p>
      </section>
      <section>
        <h2>Book information</h2>
        <p>
          Titles, authors, covers and recommendations may come from third-party
          metadata and can contain errors. Smart alternatives are suggestions,
          not endorsements. Staff can correct metadata through Giveleaf&apos;s
          management tools.
        </p>
      </section>
      <section>
        <h2>Staff access</h2>
        <p>
          Scanner access is for authorised staff and volunteers. Accounts are
          personal, must not be shared and may only be used for the assigned
          shop. Inventory and account actions are recorded for security and
          operational accountability.
        </p>
      </section>
      <section>
        <h2>Availability</h2>
        <p>
          Giveleaf is provided on a pilot basis. We aim to keep it available and
          accurate but cannot promise uninterrupted service. Participating shops
          remain responsible for their physical stock and normal retail duties.
        </p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          Report incorrect listings, security concerns or service problems to{" "}
          <a href={`mailto:${siteConfig.supportEmail}`}>
            {siteConfig.supportEmail}
          </a>.
        </p>
      </section>
      <p className="policy-updated">Effective 24 July 2026.</p>
    </PolicyPage>
  );
}

