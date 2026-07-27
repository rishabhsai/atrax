export type SpecRow = {
  property: string;
  value: string;
  /** Render the value in a monospace code box. */
  code?: boolean;
};

type SpecTableProps = {
  /** Mono microlabel shown in the panel head. */
  title: string;
  /** Right-hand microlabel in the panel head, usually a status word. */
  meta?: string;
  rows: readonly SpecRow[];
  caption?: string;
  dark?: boolean;
};

/** Two-column property/value table for a product's contract surface. */
export function SpecTable({
  title,
  meta,
  rows,
  caption,
  dark = false,
}: SpecTableProps) {
  return (
    <div className={`panel${dark ? " panel-dark" : ""}`}>
      <div className="panel-head">
        <span>{title}</span>
        {meta ? <span>{meta}</span> : null}
      </div>
      <dl className="spec-table">
        {rows.map((row) => (
          <div key={row.property}>
            <dt>{row.property}</dt>
            <dd>{row.code ? <code>{row.value}</code> : row.value}</dd>
          </div>
        ))}
      </dl>
      {caption ? <p className="spec-caption">{caption}</p> : null}
    </div>
  );
}
