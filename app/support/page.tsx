import type { Metadata } from "next";
import { siteConfig } from "../../config/site";
import { PolicyPage } from "../components/policy-page";

export const metadata: Metadata = {
  title: "Support",
  alternates: {
    canonical: "/support",
  },
};

export default function SupportPage() {
  return (
    <PolicyPage
      eyebrow="Support"
      title="Start with the quickest fix."
      intro="Giveleaf is designed to keep working when a cover, camera or external book service is unavailable."
    >
      <section>
        <h2>Camera will not open</h2>
        <p>
          Confirm camera permission is enabled for the scanner website, reload
          the page and try again. You can always type the 13-digit ISBN printed
          above the barcode.
        </p>
      </section>
      <section>
        <h2>A book is wrong or has no cover</h2>
        <p>
          A shop manager can open Management → Inventory → Edit to correct the
          title, author or cover URL. The visible Giveleaf placeholder is used
          when no reliable cover exists.
        </p>
      </section>
      <section>
        <h2>Account problems</h2>
        <p>
          Ask a shop manager to enable the account or set a temporary password.
          Invitation codes expire and can be used only for their nominated shop.
        </p>
      </section>
      <section>
        <h2>Contact the pilot</h2>
        <p>
          Email{" "}
          <a href={`mailto:${siteConfig.supportEmail}`}>
            {siteConfig.supportEmail}
          </a>{" "}
          with the shop, username, device and a screenshot. Never send a password.
        </p>
      </section>
    </PolicyPage>
  );
}

