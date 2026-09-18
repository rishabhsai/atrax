"use client";

import { useId, useState } from "react";
import styles from "../home.module.css";

const order = {
  title: "Create an order",
  app: "Orders",
  description: "An authorized person or agent creates an order in Orders.",
  position: 0,
};
const steps = [
  order,
  {
    title: "Reserve stock",
    app: "Inventory action",
    description:
      "Orders calls Inventory's stock-reservation action with the caller's permissions.",
    position: 1,
  },
  {
    title: "Continue the work",
    app: "Orders",
    description:
      "Inventory returns the result so Orders can continue. An authorized agent can use the same operation.",
    position: 2,
  },
];

export function ActionStory() {
  const [step, setStep] = useState(order);
  const descriptionId = useId();

  return (
    <div
      className={styles["action-story"]}
      aria-label="Illustrated order workflow"
    >
      <div className={styles["story-top"]}>
        <span>One order, two apps</span>
        <span>Illustrated workflow</span>
      </div>
      <div
        className={styles["story-steps"]}
        role="group"
        aria-label="Explore the order workflow"
      >
        {steps.map((item) => (
          <button
            key={item.title}
            type="button"
            aria-pressed={item === step}
            aria-controls={descriptionId}
            onClick={() => setStep(item)}
          >
            <span>0{item.position + 1}</span>
            <strong>{item.title}</strong>
            <small>{item.app}</small>
          </button>
        ))}
      </div>
      <div className={styles["story-track"]} aria-hidden="true">
        <span style={{ transform: `translateX(${step.position * 100}%)` }} />
      </div>
      <p
        id={descriptionId}
        className={styles["story-description"]}
        role="status"
        aria-live="polite"
      >
        {step.description}
      </p>
    </div>
  );
}
