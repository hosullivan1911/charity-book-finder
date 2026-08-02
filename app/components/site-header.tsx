import Link from "next/link";
import { ScanIcon } from "./icons";

export function SiteHeader({ staff = false }: { staff?: boolean }) {
  const siteMode = process.env.SITE_MODE;

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Giveleaf Books home">
        <span className="brand-mark" aria-hidden="true"><span /></span>
        <span>giveleaf</span>
      </Link>
      <nav aria-label="Primary navigation">
        {siteMode !== "scanner" && (
          <Link className={!staff ? "nav-link active" : "nav-link"} href="/">
            Browse
          </Link>
        )}
        {siteMode !== "catalogue" && (
          <Link className={staff ? "staff-link active" : "staff-link"} href="/staff">
            <ScanIcon />
            Shop
          </Link>
        )}
      </nav>
    </header>
  );
}
