import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsShell } from "../../components/DocsShell";
import { docOrder, docs } from "../../lib/docs";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return docOrder
    .map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = docs[slug];
  if (!doc) return {};
  return { title: doc.title, description: doc.description };
}

export default async function DocPage({ params }: PageProps) {
  const { slug } = await params;
  const doc = docs[slug];
  if (!doc) notFound();
  return <DocsShell doc={doc} />;
}
