import { auth, signIn } from "@/auth";
import { listApplications } from "@/lib/data";
import SiteHeader from "./site-header";
import Tracker from "./tracker";

const buttonClass =
  "rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background";

export default async function Home() {
  const session = await auth();
  const user = session?.user;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 font-sans">
      <SiteHeader user={user} current="/" />
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
