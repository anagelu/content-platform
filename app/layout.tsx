import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { auth, signOut } from "@/auth";
import { SiteSidebar } from "./site-sidebar";
import { getSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "Pattern Foundry",
  description: "A platform where ideas become patterns, frameworks, and media.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, siteSettings] = await Promise.all([auth(), getSiteSettings()]);

  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-shell site-header-inner">
            <Link
              href="/"
              className="brand-lockup"
            >
              <span className="brand-mark" aria-hidden="true">
                <span className="brand-mark-cell brand-mark-cell-a" />
                <span className="brand-mark-cell brand-mark-cell-b" />
                <span className="brand-mark-cell brand-mark-cell-c" />
                <span className="brand-mark-cell brand-mark-cell-d" />
              </span>
              <span className="brand-wordmark">
                <span className="brand-wordmark-top">Pattern</span>
                <span className="brand-wordmark-bottom">Foundry</span>
              </span>
            </Link>

            <nav className="site-header-nav">
              <form action="/search" method="get" className="site-search-form">
                <input
                  type="search"
                  name="q"
                  className="site-search-input"
                  placeholder="Search site..."
                />
                <button type="submit" className="button-link secondary">
                  Search
                </button>
              </form>
              {session ? (
                <>
                  <span className="site-session-label">
                    {session.user.name || session.user.email || "Signed in"}{" "}
                    {session.user.role === "admin" ? "(Admin)" : ""}
                  </span>
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/" });
                    }}
                  >
                    <button type="submit" className="submit-button">
                      Sign Out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="button-link secondary">
                    Sign In
                  </Link>
                  <Link href="/signup" className="button-link">
                    Create Account
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>

        <div className="app-shell">
          <div className="app-shell-inner">
            <SiteSidebar
              isAdmin={session?.user?.role === "admin"}
              isAuthenticated={Boolean(session?.user?.id)}
              siteSettings={siteSettings}
            />
            <div className="app-content">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
