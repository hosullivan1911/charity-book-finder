import { ReactNode } from "react";
import { SiteHeader } from "./site-header";

export function PolicyPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main>
      <SiteHeader />
      <article className="policy-page">
        <p className="kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="policy-intro">{intro}</p>
        <div className="policy-content">{children}</div>
      </article>
    </main>
  );
}

