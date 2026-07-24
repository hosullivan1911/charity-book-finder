import { siteConfig } from "../../config/site";
import { PolicyPage } from "../components/policy-page";

export const metadata = { title: "Accessibility" };

export default function AccessibilityPage() {
  return (
    <PolicyPage
      eyebrow="Accessibility"
      title="Giveleaf should work for every reader and volunteer."
      intro="We aim for clear language, strong contrast, keyboard access and resilient alternatives to camera scanning."
    >
      <section>
        <h2>Available alternatives</h2>
        <p>
          Staff can type an ISBN when camera access is unavailable. Public book
          search, distance controls and management actions are usable with a
          keyboard, and form errors are announced to assistive technology.
        </p>
      </section>
      <section>
        <h2>Known limitations</h2>
        <p>
          Book-cover images are supplied by third parties and are decorative;
          the title and author remain available as text. Some mobile camera and
          browser combinations may require manual ISBN entry.
        </p>
      </section>
      <section>
        <h2>Tell us what is difficult</h2>
        <p>
          Email{" "}
          <a href={`mailto:${siteConfig.supportEmail}`}>
            {siteConfig.supportEmail}
          </a>{" "}
          with the page, device and problem. We will prioritise barriers that
          prevent someone from searching or managing inventory.
        </p>
      </section>
    </PolicyPage>
  );
}

