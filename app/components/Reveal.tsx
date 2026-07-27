"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type RevealProps = {
  children: ReactNode;
  /** Extra classes applied alongside `.reveal`. */
  className?: string;
  /** Stagger in milliseconds, written to `--reveal-delay`. */
  delay?: number;
  id?: string;
};

/**
 * Reveals its children once, when they scroll into view.
 *
 * Uses IntersectionObserver plus a CSS transition. There is no scroll-linked
 * animation API here on purpose. Under `prefers-reduced-motion: reduce` the
 * stylesheet keeps the content visible and static regardless of this state.
 */
export function Reveal({ children, className, delay = 0, id }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // A section taller than the viewport can never reach a 0.2 ratio, so
          // accept either the ratio or a meaningful slice of visible height.
          const enough =
            entry.intersectionRatio >= 0.2 ||
            entry.intersectionRect.height >= 200;
          if (entry.isIntersecting && enough) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: [0, 0.2], rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const classes = ["reveal", visible ? "is-visible" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      id={id}
      ref={ref}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
