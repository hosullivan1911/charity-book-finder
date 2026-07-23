import Link from "next/link";
import { BookIcon, ScanIcon } from "./icons";

export function SiteHeader({ staff = false }: { staff?: boolean }) {
  const siteMode = process.env.SITE_MODE;

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Goodfind home">
        <span className="brand-mark">
          <BookIcon />
        </span>
        <span>goodfind</span>
      </Link>
      <nav aria-label="Primary navigation">
        {siteMode !== "scanner" && (
          <Link className={!staff ? "nav-link active" : "nav-link"} href="/">
            Find books
          </Link>
        )}
        {siteMode !== "catalogue" && (
          <Link className={staff ? "staff-link active" : "staff-link"} href="/staff">
            <ScanIcon />
            Shop scanner
          </Link>
        )}
      </nav>
    </header>
  );
}
