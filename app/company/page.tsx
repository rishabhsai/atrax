import Link from "next/link";

export const metadata = {
  title: "Company",
  description:
    "Tarantula is building the application platform for software made and operated by agents.",
};

export default function CompanyPage() {
  return (
    <main>
      <section className="company-hero">
        <div className="shell">
          <p className="eyebrow">Tarantula Systems</p>
          <h1>Software is becoming capable of building more software.</h1>
          <p>
            Its runtime should be designed for that reality from the first line
            of code to the thousandth operating cycle.
          </p>
        </div>
      </section>

      <section className="section shell company-grid">
        <p className="section-label">What we believe</p>
        <div>
          <p className="company-statement">
            Coding agents do not need a larger catalog of cloud primitives.
            They need a smaller, more coherent application contract.
          </p>
          <p>
            Tarantula brings interface, server logic, data, identity, storage,
            integrations, continuous work, and inter-application tools into one
            system. The constraints are intentional. They make software easier
            for agents to build and safer for companies to operate.
          </p>
        </div>
      </section>

      <section className="company-contact">
        <div className="shell company-contact-grid">
          <div>
            <p className="eyebrow">Private alpha</p>
            <h2>Bring us one workflow your company should not be doing by hand.</h2>
          </div>
          <form className="alpha-form">
            <label>
              Work email
              <input type="email" placeholder="you@company.com" />
            </label>
            <label>
              What should keep working?
              <textarea placeholder="A short description of the system or recurring workflow..." />
            </label>
            <button className="button button-accent" type="button">
              Request access ↗
            </button>
            <small>
              Alpha requests are reviewed personally. No automated mailing list.
            </small>
          </form>
        </div>
      </section>

      <section className="closing-cta shell">
        <p className="eyebrow">Explore</p>
        <h2>See the platform as one connected system.</h2>
        <Link className="text-link" href="/products">
          View all products <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}
