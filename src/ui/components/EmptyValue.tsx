/** Neutral dash for a missing value, announced to screen readers as `label`. */
export function EmptyValue({ label }: { label: string }) {
  return (
    <>
      <span aria-hidden="true">–</span>
      <span className="visually-hidden">{label}</span>
    </>
  );
}
