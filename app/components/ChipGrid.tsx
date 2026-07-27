export type ChipState = "available" | "planned";

export type Chip = {
  label: string;
  state?: ChipState;
};

export type ChipRow = {
  label: string;
  chips: readonly (Chip | string)[];
  /** Applied to every chip in the row unless the chip sets its own state. */
  state?: ChipState;
};

type ChipGridProps = {
  rows: readonly ChipRow[];
  /** Renders on a dark surface. */
  dark?: boolean;
  /** Quiet caption under the grid. */
  note?: string;
};

/**
 * Labelled rows of chips. A filled green square means available today, a
 * hollow square means planned. The dot is never the only signal: planned rows
 * are also labelled and dimmed.
 */
export function ChipGrid({ rows, dark = false, note }: ChipGridProps) {
  return (
    <>
      <div className={`chip-grid${dark ? " chip-grid-dark" : ""}`}>
        {rows.map((row) => (
          <div className="chip-row" key={row.label}>
            <p className="chip-row-label">{row.label}</p>
            <ul className="chip-list">
              {row.chips.map((entry) => {
                const chip: Chip =
                  typeof entry === "string" ? { label: entry } : entry;
                const state = chip.state ?? row.state ?? "available";
                return (
                  <li className={`chip chip-${state}`} key={chip.label}>
                    <i aria-hidden="true" />
                    {chip.label}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {note ? <p className="chip-note">{note}</p> : null}
    </>
  );
}
