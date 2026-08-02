import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>Giveleaf Books · Making charity-shop books easier to find.</p>
      <nav aria-label="Legal and support">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/accessibility">Accessibility</Link>
        <Link href="/support">Support</Link>
      </nav>
    </footer>
  );
}
