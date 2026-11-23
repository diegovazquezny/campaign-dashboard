export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 px-4 pt-6 pb-24 sm:px-8 sm:pt-8 sm:pb-16">
      {children}
    </main>
  );
}
