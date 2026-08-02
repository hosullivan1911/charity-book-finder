import { notFound } from "next/navigation";
import { SiteHeader } from "../components/site-header";
import { StaffScanner } from "../components/staff-scanner";

export const metadata = {
  title: "Scanner preview test",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ScannerTestPage() {
  if (
    process.env.VERCEL_ENV !== "preview" &&
    process.env.NODE_ENV !== "development"
  ) {
    notFound();
  }

  return (
    <main className="staff-page">
      <SiteHeader staff />
      <StaffScanner
        shop={{
          id: -1,
          slug: "preview-test",
          name: "Preview test shop",
          address: "Preview only",
          postcode: "0000",
          openingHours: "Preview only",
        }}
        username="preview-tester"
        role="staff"
      />
    </main>
  );
}
