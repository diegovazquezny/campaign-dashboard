// A message card: empty states, loading and errors. role="alert" renders in the error colour.
export function Notice({
  role,
  children,
}: {
  role?: "alert";
  children: React.ReactNode;
}) {
  return (
    <p
      role={role}
      className={
        "m-0 rounded-ctl border bg-card p-6 " +
        (role === "alert" ? "border-bad text-bad" : "border-border text-muted")
      }
    >
      {children}
    </p>
  );
}
