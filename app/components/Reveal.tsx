"use client";

import { useEffect, useRef, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  id?: string;
};

/** Content stays visible without JavaScript. Motion is a one-time enhancement. */
export function Reveal({
  children,
  className = "",
  delay = 0,
  id,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) return;
    let animation: Animation | undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        animation = node.animate(
          [
            { opacity: 0.5, transform: "translateY(24px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 750, delay, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
        );
      },
      { threshold: 0.12 },
    );

    function stopMotion() {
      if (!preference.matches) return;
      observer.disconnect();
      animation?.cancel();
    }

    observer.observe(node);
    preference.addEventListener("change", stopMotion);
    return () => {
      observer.disconnect();
      animation?.cancel();
      preference.removeEventListener("change", stopMotion);
    };
  }, [delay]);

  return (
    <div className={`reveal is-visible ${className}`} id={id} ref={ref}>
      {children}
    </div>
  );
}
