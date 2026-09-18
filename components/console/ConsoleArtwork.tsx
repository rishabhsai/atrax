import Image from "next/image";
import styles from "./console.module.css";

const artwork = {
  entry: "/images/console/woven-entry.webp",
  workspace: "/images/console/woven-workspace.webp",
  library: "/images/home/woven-library-800.webp",
};

export function ConsoleArtwork({ kind }: { kind: keyof typeof artwork }) {
  return (
    <div
      className={kind === "entry" ? styles.authArtwork : styles.emptyArtwork}
      aria-hidden="true"
    >
      <Image
        src={artwork[kind]}
        alt=""
        fill
        sizes={kind === "entry" ? "400px" : "180px"}
      />
    </div>
  );
}
