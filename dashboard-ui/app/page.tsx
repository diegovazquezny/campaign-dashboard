import { Suspense } from "react";
import { connection } from "next/server";
import { ApiStatus } from "../components/api-status";

async function checkApi(): Promise<boolean> {
  // Opt into request-time rendering so API_URL is read at runtime and the
  // fetch is never prerendered into the static shell.
  await connection();
  const apiUrl = process.env.API_URL ?? "http://localhost:3001";
  try {
    const res = await fetch(`${apiUrl}/up`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function ApiStatusLoader() {
  return <ApiStatus ok={await checkApi()} />;
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 font-sans">
      <h1 className="text-3xl font-semibold tracking-tight">
        Campaign Dashboard
      </h1>
      <Suspense fallback={<p>API: checking...</p>}>
        <ApiStatusLoader />
      </Suspense>
    </main>
  );
}
