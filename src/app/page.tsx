import { listApplications } from "@/lib/data";
import Tracker from "./tracker";

export default async function Home() {
  const applications = await listApplications();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-10 font-sans">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Job Application Tracker
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Keep track of every application and where it stands.
        </p>
      </header>
      <Tracker applications={applications} />
    </main>
  );
}
