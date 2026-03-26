import { auth } from "@/auth";
import { searchSiteContent } from "@/lib/site-search";
import Link from "next/link";

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const params = searchParams ? await searchParams : undefined;
  const rawQuery = params?.q;
  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
  const userId = session?.user?.id ? Number(session.user.id) : null;
  const results = query
    ? await searchSiteContent({
        query,
        userId,
        isAdmin: session?.user?.role === "admin",
      })
    : [];

  return (
    <main>
      <div className="site-shell">
        <h1 className="page-title">Search</h1>
        <p className="page-subtitle">
          Search pages, posts, books, trading records, patents, and workspace routes.
        </p>

        <form action="/search" method="get" className="site-search-form site-search-form-page">
          <input
            type="search"
            name="q"
            defaultValue={query}
            className="site-search-input"
            placeholder="Search the site..."
          />
          <button type="submit" className="button-link">
            Search
          </button>
        </form>

        {!query ? (
          <div className="card">
            <p>Type a topic, title, market, setup, or page name to search the site.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="card">
            <p>No results for &quot;{query}&quot;. Try a broader keyword or page name.</p>
          </div>
        ) : (
          <>
            <p className="meta" style={{ marginTop: "1.25rem" }}>
              {results.length} result{results.length === 1 ? "" : "s"} for &quot;{query}&quot;
            </p>
            <ul className="card-list">
              {results.map((result) => (
                <li key={`${result.kind}-${result.id}`} className="card">
                  <h2 className="card-title">
                    <Link href={result.href}>{result.title}</Link>
                  </h2>
                  <p className="meta">
                    {result.kind} · {result.visibility === "private" ? "Workspace" : "Public"} ·{" "}
                    <Link href={result.href}>{result.href}</Link>
                  </p>
                  <p className="preview">{result.excerpt}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
