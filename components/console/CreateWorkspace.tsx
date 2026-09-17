"use client";

import { useId, useState, type FormEvent } from "react";
import { api, type Workspace } from "./api";
import { ErrorNotice } from "./ConsoleFrame";
import { useSubmission } from "./useConsole";
import styles from "./console.module.css";

type CreateWorkspaceProps = {
  onCreated: (workspace: Workspace) => void;
  title?: string;
  description?: string;
  variant?: "section" | "inline";
};

function workspaceSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CreateWorkspace({
  onCreated,
  title = "Create a workspace",
  description = "A shared home for your team's apps and company knowledge.",
  variant = "section",
}: CreateWorkspaceProps) {
  const fieldId = useId();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const command = useSubmission();

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { name: name.trim(), slug: slug.trim() };
    const result = await command.run(JSON.stringify(input), (key) =>
      api.createWorkspace(input, key),
    );
    if (result) onCreated(result);
  }

  const nameId = `${fieldId}-name`;
  const slugId = `${fieldId}-slug`;
  const slugHelpId = `${fieldId}-slug-help`;
  return (
    <section
      className={variant === "inline" ? styles.inlineNote : styles.section}
      aria-labelledby={`${fieldId}-heading`}
    >
      <h2 id={`${fieldId}-heading`}>{title}</h2>
      <p className={styles.muted}>{description}</p>
      <form onSubmit={create} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor={nameId}>Workspace name</label>
          <input
            id={nameId}
            required
            maxLength={100}
            autoComplete="organization"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slugEdited) setSlug(workspaceSlug(event.target.value));
            }}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={slugId}>Workspace handle</label>
          <input
            id={slugId}
            required
            minLength={2}
            maxLength={48}
            pattern="[a-z][a-z0-9\-]{1,47}"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={slug}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(event.target.value);
            }}
            aria-describedby={slugHelpId}
          />
          <small id={slugHelpId}>
            Use 2–48 lowercase letters, numbers, or hyphens, starting with a
            letter.
          </small>
        </div>
        {command.state.kind === "error" && (
          <ErrorNotice message={command.state.message} />
        )}
        <div className={styles.actions}>
          <button
            className={styles.primary}
            type="submit"
            disabled={command.state.kind === "pending"}
          >
            {command.state.kind === "pending"
              ? "Creating workspace…"
              : "Create workspace"}
          </button>
        </div>
      </form>
    </section>
  );
}
