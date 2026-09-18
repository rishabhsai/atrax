"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import styles from "../home.module.css";

const pointerMediaQuery =
  "(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)";

function clamp(value: number, limit: number) {
  return Math.max(-limit, Math.min(limit, value));
}

type PointerTrackingTarget = {
  atmosphere: HTMLDivElement;
  hero: HTMLElement;
};

function trackPointer({ atmosphere, hero }: PointerTrackingTarget) {
  const preference = window.matchMedia(pointerMediaQuery);
  let frame: number | undefined;
  let pointerX = 0;
  let pointerY = 0;
  let tracking = false;

  function setPointer(x: number, y: number) {
    atmosphere.style.setProperty("--pointer-x", `${x}px`);
    atmosphere.style.setProperty("--pointer-y", `${y}px`);
  }

  function cancelFrame() {
    if (frame !== undefined) {
      window.cancelAnimationFrame(frame);
      frame = undefined;
    }
  }

  function resetPointer() {
    cancelFrame();
    pointerX = 0;
    pointerY = 0;
    setPointer(0, 0);
  }

  function flushPointer() {
    frame = undefined;
    setPointer(pointerX, pointerY);
  }

  function handlePointerMove(event: PointerEvent) {
    const bounds = hero.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    pointerX = clamp(
      ((event.clientX - bounds.left) / bounds.width - 0.5) * 24,
      12,
    );
    pointerY = clamp(
      ((event.clientY - bounds.top) / bounds.height - 0.5) * 16,
      8,
    );

    if (frame === undefined) frame = window.requestAnimationFrame(flushPointer);
  }

  function enablePointerTracking() {
    if (tracking) return;
    hero.addEventListener("pointermove", handlePointerMove);
    hero.addEventListener("pointerleave", resetPointer);
    tracking = true;
  }

  function disablePointerTracking() {
    if (tracking) {
      hero.removeEventListener("pointermove", handlePointerMove);
      hero.removeEventListener("pointerleave", resetPointer);
      tracking = false;
    }
    resetPointer();
  }

  function updatePreference() {
    if (preference.matches) enablePointerTracking();
    else disablePointerTracking();
  }

  preference.addEventListener("change", updatePreference);
  updatePreference();

  return () => {
    preference.removeEventListener("change", updatePreference);
    disablePointerTracking();
  };
}

export function HeroAtmosphere() {
  const atmosphereRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const atmosphere = atmosphereRef.current;
    const hero = atmosphere?.closest("section");

    if (!atmosphere || !hero) return;

    return trackPointer({ atmosphere, hero });
  }, []);

  return (
    <div className={styles.atmosphere} aria-hidden="true" ref={atmosphereRef}>
      <div className={styles.landscape}>
        <Image
          src="/images/home/landscape-hero.webp"
          alt=""
          fill
          sizes="100vw"
          preload
        />
      </div>
    </div>
  );
}
