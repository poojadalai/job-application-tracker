import Link from "next/link";
import type { Session } from "next-auth";
import { signOut } from "@/auth";

const TABS = [
  { href: "/", label: "Board" },
  { href: "/stats", label: "Stats" },
] as const;

type Tab = (typeof TABS)[number]["href"];

// Each page passes its own path as `current`, so the header stays a Server
// Component instead of reading the URL with usePathname() on the client.
export default function SiteHeader({
  user,
  current,
}: {
  user?: Session["user"];
  current: Tab;
}) {
  return (
    <header className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
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
      </div>
      {user?.id && (
        <nav
          aria-label="Main"
          className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800"
        >
          {TABS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={current === href ? "page" : undefined}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                current === href
                  ? "border-foreground"
                  : "border-transparent text-zinc-600 hover:text-foreground dark:text-zinc-400"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
