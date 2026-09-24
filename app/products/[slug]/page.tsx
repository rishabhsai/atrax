import { SupportHero } from "../../components/SupportHero";
import styles from "../../components/support.module.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChipGrid } from "../../components/ChipGrid";
import { Reveal } from "../../components/Reveal";
import { SpecTable } from "../../components/SpecTable";
import { ProductMark } from "../../components/Visuals";
import { productOrder, products } from "../../lib/content";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return productOrder.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = Object.values(products).find(
    (candidate) => candidate.slug === slug,
  );
  if (!product) return {};
  return {
    title: product.name,
    description: product.summary,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = Object.values(products).find(
    (candidate) => candidate.slug === slug,
  );
  if (!product) notFound();

  const available = product.availability === "available";

  return (
    <main className={styles.page}>
      <SupportHero
        title={product.title}
        description={product.summary}
        artwork={product.slug === "access" ? "access" : product.slug === "library" ? "library" : product.slug === "apps" || product.slug === "database" ? "apps" : "threads"}
      >
        <Link className="button button-dark" href={`/docs/${product.slug}`}>
          Read {product.name} docs <span aria-hidden="true">→</span>
        </Link>
        <Link className="text-link" href="/#products">All products</Link>
      </SupportHero>

      <section className={styles.boundary}>
        <div className={styles.shell}>
          <p>{product.boundary}</p>
        </div>
      </section>

      <section className={`${styles.section} ${styles.shell}`}>
        <div className={styles.split}>
          <Reveal className={styles.copy}>
            <h2>
              {available
                ? `What you can do with ${product.name}.`
                : "What comes later."}
            </h2>
            <div className={styles.capabilities}>
              {product.features.map(([name, copy], index) => (
                <article key={name}>
                  <span>0{index + 1}</span>
                  <h3>{name}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </Reveal>
          <Reveal className={styles.spec} delay={120}>
            <SpecTable
              caption={
                available
                  ? "Available in the current release."
                  : "Planned for a later release."
              }
              meta={product.availability}
              rows={product.spec}
              title="The details"
            />
            <div className="panel">
              <div className="panel-head">
                <span>Works with</span>
              </div>
              <ChipGrid
                rows={[
                  {
                    label: "Related",
                    state: "available" as const,
                    chips: product.related.map((slug) => products[slug].name),
                  },
                ]}
              />
            </div>
          </Reveal>
        </div>
      </section>

      <section className={styles.codeSection}>
        <div className={`${styles.shell} ${styles.codeGrid}`}>
          <div className={styles.copy}>
            <h2>
              {available
                ? "Use this from the CLI or your agent."
                : "Use an existing agent today."}
            </h2>
            <p>
              {available
                ? "Use the CLI for this workflow. Connected agents can discover workspace operations through MCP with the same permission checks."
                : "Connect an existing agent through MCP for request-driven work."}
            </p>
            <a className="text-link" href="/agents.md">
              Give this to your agent <span aria-hidden="true">→</span>
            </a>
          </div>
          <pre>
            <code>{product.code}</code>
          </pre>
        </div>
      </section>

      <section className={`${styles.section} ${styles.shell} ${styles.related}`}>
        <div className={styles.intro}>
          <h2>Related products</h2>
        </div>
        <div>
          {product.related.map((relatedSlug) => {
            const related = products[relatedSlug];
            return (
              <Link href={`/products/${relatedSlug}`} key={relatedSlug}>
                <ProductMark type={relatedSlug} />
                <span>{related.name}</span>
                <b aria-hidden="true">↗</b>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
