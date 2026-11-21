export function ApiStatus({ ok }: { ok: boolean }) {
  return <p>{ok ? "API: OK" : "API: unreachable"}</p>;
}
