export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 px-8 pt-8 pb-16">
      {children}
    </main>
  );
}
