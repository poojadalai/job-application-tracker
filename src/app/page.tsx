import { auth, signIn, signOut } from "@/auth";
import { listApplications } from "@/lib/data";
import Tracker from "./tracker";

const buttonClass =
  "rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background";

export default async function Home() {
  const session = await auth();
  const user = session?.user;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 font-sans">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            Job Application Tracker
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Keep track of every application and where it stands.
          </p>
        </div>
        {user && (
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
            className="flex items-center gap-3"
          >
            {user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt=""
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {user.name ?? user.email}
            </span>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
            >
              Sign out
            </button>
          </form>
        )}
      </header>
      {user?.id ? (
        <Tracker applications={await listApplications()} />
      ) : (
        <section className="flex flex-col items-center gap-4 rounded-lg border border-zinc-200 p-12 text-center dark:border-zinc-800">
          <h2 className="text-xl font-semibold">Sign in to see your board</h2>
          <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
            Your applications are private to your GitHub account.
          </p>
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/" });
            }}
          >
            <button type="submit" className={buttonClass}>
              Sign in with GitHub
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
