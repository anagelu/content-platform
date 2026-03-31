"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  hint?: string;
  exact?: boolean;
};

type NavSection = {
  title: string;
  description?: string;
  items: NavItem[];
};

const primarySections: NavSection[] = [
  {
    title: "Main Paths",
    description: "Start from capture, then move toward finished assets.",
    items: [
      { href: "/", label: "Home", hint: "overview", exact: true },
      { href: "/about", label: "About", hint: "mission" },
      { href: "/#start-with-an-idea", label: "Capture", hint: "start" },
      { href: "/posts", label: "Posts", hint: "publishing" },
      { href: "/patents", label: "Patents", hint: "filings" },
      { href: "/studio", label: "Studio", hint: "distribution" },
    ],
  },
];

const secondaryItems: NavItem[] = [
  { href: "/books", label: "Books", hint: "manuscripts" },
  { href: "/search", label: "Search", hint: "finder" },
  { href: "/trading", label: "Trading", hint: "markets" },
  { href: "/categories", label: "Categories", hint: "taxonomy" },
  { href: "/inbox/messages", label: "Inbox", hint: "capture" },
  { href: "/os", label: "OS", hint: "workspace" },
];

const contextualSections: Array<{
  match: (pathname: string) => boolean;
  title: string;
  description?: string;
  items: NavItem[];
}> = [
  {
    match: (pathname) => pathname.startsWith("/books"),
    title: "Books",
    description: "Move from idea to structured manuscript draft.",
    items: [
      { href: "/books", label: "All Books", hint: "library", exact: true },
      { href: "/books/new", label: "New Book", hint: "start" },
      { href: "/posts/new", label: "New Post", hint: "spin out" },
    ],
  },
  {
    match: (pathname) => pathname.startsWith("/trading"),
    title: "Trading",
    description: "Session planning, chart review, journaling, and automation.",
    items: [
      { href: "/trading", label: "Overview", hint: "home", exact: true },
      { href: "/trading/new", label: "New Session", hint: "plan" },
      { href: "/trading/journal", label: "Journal", hint: "review" },
      { href: "/trading/chart", label: "Chart", hint: "workflow" },
      { href: "/trading/screener", label: "Screener", hint: "scan" },
      { href: "/trading/tools", label: "Tools", hint: "readers" },
      { href: "/trading/algo", label: "Algo", hint: "automation" },
      { href: "/trading/recommendations", label: "Recommendations", hint: "ideas" },
      { href: "/trading/pipeline", label: "Pipeline", hint: "tracking" },
    ],
  },
  {
    match: (pathname) => pathname.startsWith("/posts"),
    title: "Publishing",
    description: "Shape and organize public-facing writing.",
    items: [
      { href: "/posts", label: "All Posts", hint: "archive", exact: true },
      { href: "/posts/new", label: "New Post", hint: "draft" },
      { href: "/books/new", label: "New Book", hint: "expand" },
      { href: "/categories", label: "Categories", hint: "group" },
    ],
  },
  {
    match: (pathname) => pathname.startsWith("/categories"),
    title: "Categories",
    description: "Navigate the publishing taxonomy and topic clusters.",
    items: [
      { href: "/categories", label: "All Categories", hint: "browse", exact: true },
      { href: "/posts", label: "Published Posts", hint: "reading" },
      { href: "/posts/new", label: "New Post", hint: "create" },
    ],
  },
  {
    match: (pathname) => pathname.startsWith("/patents"),
    title: "Patents",
    description: "Capture invention logic and filing readiness.",
    items: [
      { href: "/patents", label: "Overview", hint: "workspace", exact: true },
      { href: "/patents/new", label: "New Patent Draft", hint: "start" },
    ],
  },
  {
    match: (pathname) => pathname.startsWith("/studio"),
    title: "Studio",
    description: "Repurpose strong ideas into distribution-ready formats.",
    items: [{ href: "/studio", label: "Overview", hint: "channels", exact: true }],
  },
  {
    match: (pathname) => pathname.startsWith("/inbox"),
    title: "Inbox",
    description: "Capture and process incoming source material.",
    items: [{ href: "/inbox/messages", label: "Messages", hint: "source" }],
  },
  {
    match: (pathname) => pathname.startsWith("/os"),
    title: "Operating System",
    description: "Meta workspace for broader operating routines.",
    items: [{ href: "/os", label: "Overview", hint: "systems", exact: true }],
  },
  {
    match: (pathname) => pathname.startsWith("/admin"),
    title: "Admin",
    description: "Inspect provider usage and internal controls.",
    items: [{ href: "/admin/ai?range=30d", label: "AI Usage", hint: "ops" }],
  },
  {
    match: (pathname) =>
      pathname.startsWith("/login") || pathname.startsWith("/signup"),
    title: "Account",
    description: "Authentication and account entry points.",
    items: [
      { href: "/login", label: "Sign In", hint: "access", exact: true },
      { href: "/signup", label: "Create Account", hint: "join", exact: true },
    ],
  },
  {
    match: (pathname) => pathname.startsWith("/about"),
    title: "About",
    description: "Why the platform exists and how rough thinking becomes durable work.",
    items: [
      { href: "/about", label: "Overview", hint: "mission", exact: true },
      { href: "/#start-with-an-idea", label: "Capture", hint: "start" },
      { href: "/posts", label: "Posts", hint: "examples" },
    ],
  },
];

function isItemActive(pathname: string, item: NavItem) {
  if (item.exact) {
    return pathname === item.href;
  }

  if (item.href === "/") {
    return pathname === "/";
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavBlock({
  title,
  description,
  items,
  pathname,
}: NavSection & { pathname: string }) {
  return (
    <div className="site-sidebar-card">
      <p className="site-sidebar-label">{title}</p>
      {description ? <p className="site-sidebar-description">{description}</p> : null}
      <nav className="site-sidebar-nav" aria-label={title}>
        {items.map((item) => {
          const active = isItemActive(pathname, item);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? "site-sidebar-link is-active" : "site-sidebar-link"}
              aria-current={active ? "page" : undefined}
            >
              <span className="site-sidebar-link-copy">
                <span className="site-sidebar-link-title">{item.label}</span>
                {item.hint ? <span className="site-sidebar-link-hint">{item.hint}</span> : null}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function SiteSidebar({
  isAdmin,
  isAuthenticated,
}: {
  isAdmin: boolean;
  isAuthenticated: boolean;
}) {
  const pathname = usePathname();
  const matchedSection = contextualSections.find((section) =>
    section.match(pathname),
  );
  const visiblePrimarySections = primarySections.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      isAuthenticated ? true : !["/patents", "/studio"].includes(item.href),
    ),
  }));
  const visibleSecondaryItems = secondaryItems.filter((item) =>
    isAuthenticated ? true : !["/inbox/messages", "/os"].includes(item.href),
  );

  return (
    <aside className="site-sidebar">
      {visiblePrimarySections.map((section, index) => (
        <NavBlock
          key={section.title}
          title={section.title}
          description={section.description}
          items={
            isAdmin && index === primarySections.length - 1
              ? [...section.items, { href: "/admin/ai?range=30d", label: "Admin", hint: "ops" }]
              : section.items
          }
          pathname={pathname}
        />
      ))}

      {matchedSection ? (
        <NavBlock
          title={matchedSection.title}
          description={matchedSection.description}
          items={matchedSection.items}
          pathname={pathname}
        />
      ) : null}

      <details className="site-sidebar-card site-sidebar-disclosure">
        <summary className="site-sidebar-disclosure-summary">
          <span>
            <span className="site-sidebar-label">More</span>
            <span className="site-sidebar-description">
              Secondary systems, archives, and deeper workspace areas.
            </span>
          </span>
          <span className="site-sidebar-disclosure-hint">Expand</span>
        </summary>
        <nav className="site-sidebar-nav" aria-label="More">
          {[...visibleSecondaryItems, ...(isAdmin ? [{ href: "/admin/ai?range=30d", label: "Admin", hint: "ops" }] : [])].map((item) => {
            const active = isItemActive(pathname, item);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "site-sidebar-link is-active" : "site-sidebar-link"}
                aria-current={active ? "page" : undefined}
              >
                <span className="site-sidebar-link-copy">
                  <span className="site-sidebar-link-title">{item.label}</span>
                  {item.hint ? <span className="site-sidebar-link-hint">{item.hint}</span> : null}
                </span>
              </Link>
            );
          })}
        </nav>
      </details>
    </aside>
  );
}
