import { InfoTip } from "./info-tip";

// Label and info icon for a header that is not sortable. The icon trails the
// label; on right-aligned columns it is pulled into the cell padding so it
// ends close to the right edge of the numbers below.
export function ThLabel({
  label,
  help,
  align,
}: {
  label: string;
  help: string;
  align: "left" | "right";
}) {
  return (
    <span
      className={`flex items-center ${align === "right" ? "-mr-1 justify-end" : ""}`}
    >
      {label}
      <InfoTip label={label} text={help} />
    </span>
  );
}
