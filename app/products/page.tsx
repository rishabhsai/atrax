import Link from "next/link";
import { ProductMark } from "../components/Visuals";
import { products } from "../lib/content";

export const metadata = {
  title: "Products",
  description:
    "Build, Operate, Vault, and Network: the complete Tarantula platform.",
};

export default function ProductsPage() {
  return (
    <main>
      <section className="page-hero shell">
        <p className="eyebrow">Products</p>
        <h1>One runtime for the entire life of an application.</h1>
        <p>
          Tarantula combines the full-stack foundation software needs with the
          operational primitives agents need. Each part uses the same identity,
          data, permissions, and deployment model.
        </p>
      </section>
      <section className="shell suite-list">
        {Object.values(products).map((product, index) => (
          <Link href={`/products/${product.slug}`} key={product.slug}>
            <span className="suite-index">0{index + 1}</span>
            <ProductMark type={product.slug} />
            <div>
              <p>{product.eyebrow}</p>
              <h2>{product.name}</h2>
              <span>{product.summary}</span>
            </div>
            <strong aria-hidden="true">↗</strong>
          </Link>
        ))}
      </section>
      <section className="platform-principle">
        <div className="shell statement-grid">
          <p className="section-label">The principle</p>
          <p className="statement">
            Operational agents are not a separate product bolted onto an app
            platform. They are a native application primitive.
          </p>
        </div>
      </section>
    </main>
  );
}
