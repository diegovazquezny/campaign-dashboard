export function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1
      className={
        "m-0 text-h1 leading-[1.15] font-h1 tracking-h1 " +
        // Midnight: a glowing accent dot before the title.
        "dark:before:mr-2.5 dark:before:inline-block dark:before:size-2 dark:before:rounded-full dark:before:bg-accent dark:before:align-middle dark:before:shadow-[0_0_12px_var(--accent)] dark:before:content-['']"
      }
    >
      {children}
    </h1>
  );
}
