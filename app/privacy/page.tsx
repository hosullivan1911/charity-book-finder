import { siteConfig } from "../../config/site";
import { PolicyPage } from "../components/policy-page";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <PolicyPage
      eyebrow="Privacy notice"
      title="Useful data, kept to a minimum."
      intro="Giveleaf collects only the information needed to operate searchable charity-shop book inventory and protect staff access."
    >
      <section>
        <h2>Information we handle</h2>
        <p>
          Public visitors do not need an account. An address or suburb entered
          for distance search is sent to our geocoding provider to obtain
          coordinates and is not saved in Giveleaf&apos;s inventory database.
        </p>
        <p>
          Shop staff accounts contain a username, assigned shop, access level,
          password hash, session records and an activity history showing
          inventory actions. Giveleaf never stores readable passwords.
        </p>
      </section>
      <section>
        <h2>Why we use it</h2>
        <p>
          Staff data is used to secure the scanner, limit access to the correct
          shop, maintain inventory accuracy, investigate mistakes and provide
          support. We do not sell personal information or use it for advertising.
        </p>
      </section>
      <section>
        <h2>Service providers</h2>
        <p>
          Giveleaf uses Vercel for hosting, Neon for database storage, Open
          Library for book metadata and cover lookups, and OpenStreetMap
          Nominatim for Australian address search. Information may be processed
          by those providers under their own privacy and security terms.
        </p>
      </section>
      <section>
        <h2>Retention and control</h2>
        <p>
          Shop managers can disable or delete staff accounts. Security and
          inventory audit records may be retained after account deletion so
          participating shops can understand historical stock changes. A
          participating shop can request an export or deletion of its pilot
          data, subject to necessary security and legal records.
        </p>
      </section>
      <section>
        <h2>Questions or requests</h2>
        <p>
          Contact{" "}
          <a href={`mailto:${siteConfig.supportEmail}`}>
            {siteConfig.supportEmail}
          </a>{" "}
          to ask about access, correction, deletion or a suspected privacy issue.
        </p>
      </section>
      <p className="policy-updated">Effective 24 July 2026.</p>
    </PolicyPage>
  );
}

