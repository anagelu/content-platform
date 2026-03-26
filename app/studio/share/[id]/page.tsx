import { auth } from "@/auth";
import { prismaWithDistribution } from "@/lib/prisma-distribution";
import Link from "next/link";
import { redirect } from "next/navigation";

function parseMetadata(metadata: string | null) {
  if (!metadata) {
    return null;
  }

  try {
    return JSON.parse(metadata) as {
      caption?: string;
      carouselSlides?: string[];
      cta?: string;
      shareTitle?: string;
    };
  } catch {
    return null;
  }
}

export default async function StudioSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const derivative = (await prismaWithDistribution.contentDerivative.findUnique({
    where: {
      id: Number(id),
    },
    include: {
      post: true,
      tradingSession: true,
    },
  })) as
    | {
        id: number;
        title: string;
        body: string;
        channel: string;
        format: string;
        metadata: string | null;
        post: { title: string } | null;
        tradingSession: { title: string } | null;
      }
    | null;

  if (!derivative) {
    return (
      <main>
        <div className="site-shell site-shell-wide">
          <div className="card">
            <h2 className="page-title">Share page not found</h2>
            <Link href="/studio" className="button-link secondary">
              Back to Studio
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const metadata = parseMetadata(derivative.metadata);

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <article className="article-card">
          <h1 className="article-title">
            {metadata?.shareTitle || derivative.title}
          </h1>
          <p className="meta">
            Source: {derivative.post?.title || derivative.tradingSession?.title || "Unknown"}
          </p>
          <p className="meta">
            {derivative.channel} · {derivative.format.replaceAll("_", " ")}
          </p>

          {metadata?.caption ? (
            <section className="card" style={{ marginTop: "1.5rem" }}>
              <h2 className="trading-section-title">Caption</h2>
              <p>{metadata.caption}</p>
            </section>
          ) : null}

          {metadata?.carouselSlides?.length ? (
            <section className="card" style={{ marginTop: "1.5rem" }}>
              <h2 className="trading-section-title">Carousel Outline</h2>
              <div className="card-list">
                {metadata.carouselSlides.map((slide, index) => (
                  <div key={`${index}-${slide}`} className="trading-metric-card">
                    <span className="trading-metric-label">Slide {index + 1}</span>
                    <strong>{slide}</strong>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="card" style={{ marginTop: "1.5rem" }}>
            <h2 className="trading-section-title">Asset Body</h2>
            <pre className="trading-source-chat">{derivative.body}</pre>
          </section>

          {metadata?.cta ? (
            <section className="trading-insight-card">
              <h2 className="trading-section-title">Call To Action</h2>
              <p>{metadata.cta}</p>
            </section>
          ) : null}

          <div className="toolbar">
            <Link href="/studio" className="button-link secondary">
              Back to Studio
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
