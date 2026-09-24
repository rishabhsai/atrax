import Image from "next/image";
import type { ReactNode } from "react";
import styles from "./support.module.css";

type SupportHeroProps = {
  title: string;
  description: string;
  artwork?: "apps" | "library" | "access" | "threads";
  children?: ReactNode;
};

const artworkPaths = {
  apps: "/images/home/woven-apps-800.webp",
  library: "/images/home/woven-library-800.webp",
  access: "/images/home/woven-access-800.webp",
  threads: "/images/home/woven-hero-800.webp",
};

export function SupportHero({ title, description, artwork, children }: SupportHeroProps) {
  return (
    <section className={`${styles.hero} ${artwork ? styles.illustratedHero : styles.compactHero}`}>
      <div className={styles.shell}>
        <div className={styles.heroCopy}>
          <h1>{title}</h1>
          <p className={styles.lead}>{description}</p>
          {children ? <div className={styles.heroActions}>{children}</div> : null}
        </div>
        {artwork ? (
          <div className={`${styles.heroArt} ${artwork === "access" ? styles.accessArt : ""}`} aria-hidden="true">
            <Image src={artworkPaths[artwork]} alt="" fill sizes="(max-width: 760px) 90vw, 45vw" preload />
          </div>
        ) : null}
      </div>
    </section>
  );
}
