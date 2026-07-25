import Link from "next/link";

export const metadata = {
  title: "Pricing",
  description: "Current alpha pricing and Cloudflare account responsibilities.",
};

export default function PricingPage() {
  return (
    <main>
      <section className="page-hero page-hero-dark">
        <div className="shell page-hero-grid">
          <p className="eyebrow">Pricing</p>
          <div>
            <h1>The local alpha has no Tarantula bill.</h1>
            <p>
              The CLI deploys into your Cloudflare account. Cloudflare usage
              and plan limits still apply to the Worker and D1 database.
            </p>
          </div>
        </div>
      </section>

      <section className="section shell pricing-now">
        <div className="section-intro">
          <p className="eyebrow">Current v0</p>
          <h2>Bring your Cloudflare account.</h2>
        </div>
        <div className="pricing-line">
          <strong>$0</strong>
          <div>
            <h3>Tarantula alpha software</h3>
            <p>
              Install it locally from the private repository. Your configured
              Wrangler identity provisions and owns the deployed resources.
            </p>
          </div>
        </div>
        <div className="pricing-notes">
          <p>Cloudflare can bill Worker and D1 usage.</p>
          <p>There is no hosted Tarantula control plane yet.</p>
          <p>Door, Library, Switchboard, and Loops do not have prices yet.</p>
          <p>Pricing will be published before any hosted paid alpha.</p>
        </div>
      </section>

      <section className="final-cta">
        <div className="shell final-cta-grid">
          <div>
            <p className="eyebrow">Start with the working slice</p>
            <h2>Deploy the public chat.</h2>
          </div>
          <Link className="button button-orange" href="/docs/chat-example">
            Open the guide <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
