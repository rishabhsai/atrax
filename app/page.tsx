import Image from "next/image";
import Link from "next/link";
import { AgentCommand } from "./components/AgentCommand";

export const metadata = {
  title: { absolute: "Atrax | A cloud for everyone." },
  description:
    "Build with your agent. Atrax runs your apps, keeps their data, and connects your team.",
};

export default function Home() {
  return (
    <main className="home">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-trees" aria-hidden="true">
          <Image src="/images/hero-ink-trees.webp" alt="" fill sizes="100vw" preload />
        </div>
        <div className="shell home-intro">
          <h1 id="home-title">A cloud for everyone.</h1>
          <p className="home-summary">Build with your agent. Atrax runs your apps, keeps their data, and connects your team.</p>
          <AgentCommand />
          <p className="home-start-note">Start locally, no account needed. <Link href="/docs/quickstart">Read the quickstart <span aria-hidden="true">→</span></Link></p>
        </div>
      </section>

      <section className="shell home-capabilities" aria-labelledby="capabilities-title">
        <div className="home-capabilities-intro">
          <h2 id="capabilities-title">Your apps.<br /> One shared home.</h2>
          <Link className="text-link" href="/products">Explore Atrax <span aria-hidden="true">→</span></Link>
        </div>
        <dl className="home-capability-list">
          <div><dt><Link href="/products/launchpad">Build and run apps <span aria-hidden="true">↗</span></Link></dt><dd>Turn an idea into a working app with your agent. Deploy it and give your team a link.</dd></div>
          <div><dt><Link href="/docs/tables">Keep data and control access <span aria-hidden="true">↗</span></Link></dt><dd>Keep your data through updates. Make apps available to your team and choose who else can use them.</dd></div>
          <div><dt><Link href="/products/switchboard">Connect your apps <span aria-hidden="true">↗</span></Link></dt><dd>Let apps and agents use the actions your apps expose, with permission checked every time.</dd></div>
          <div><dt><Link href="/products/library">Share company context <span aria-hidden="true">↗</span></Link></dt><dd>Save files, guidance, and decisions in a Library your team and its agents can use and update.</dd></div>
        </dl>
      </section>
    </main>
  );
}
