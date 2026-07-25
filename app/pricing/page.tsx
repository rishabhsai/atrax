import Link from "next/link";

export const metadata = {
  title: "Pricing",
  description: "Simple platform pricing for the Tarantula private alpha.",
};

export default function PricingPage() {
  return (
    <main>
      <section className="page-hero shell pricing-hero">
        <p className="eyebrow">Pricing</p>
        <h1>Start with one system worth keeping alive.</h1>
        <p>
          Tarantula is currently working with a limited number of design
          partners. Alpha access includes the complete platform.
        </p>
      </section>

      <section className="shell pricing-grid">
        <div className="pricing-main">
          <div>
            <p>Private alpha</p>
            <h2>Design partner</h2>
          </div>
          <div className="price">
            <strong>Custom</strong>
            <span>based on operating volume</span>
          </div>
          <ul>
            <li>Unlimited builders and internal viewers</li>
            <li>Build, Operate, Vault, and Network</li>
            <li>Direct product and architecture support</li>
            <li>Usage-based compute and model costs</li>
            <li>Early influence over the runtime contract</li>
          </ul>
          <Link className="button button-accent" href="/company">
            Apply for access ↗
          </Link>
        </div>
        <div className="pricing-note">
          <p className="eyebrow">Pricing principle</p>
          <h2>Pay for software operating, not humans viewing it.</h2>
          <p>
            Internal teammates should not become a tax on adoption. Our planned
            pricing follows active applications and their operating usage.
          </p>
          <div>
            <span>Builders</span>
            <strong>Included</strong>
          </div>
          <div>
            <span>Internal viewers</span>
            <strong>Included</strong>
          </div>
          <div>
            <span>Execution</span>
            <strong>Usage based</strong>
          </div>
        </div>
      </section>

      <section className="closing-cta shell">
        <p className="eyebrow">Not ready for the alpha?</p>
        <h2>Follow the platform as the public developer preview approaches.</h2>
        <Link className="text-link" href="/company">
          Get product updates <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}
