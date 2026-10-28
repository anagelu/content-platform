const DEFAULT_SITE_URL = "https://patternfoundryai.com";

function normalize(url: string) {
  return url.replace(/\/+$/, "");
}

export const SITE_URL = normalize(
  process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || DEFAULT_SITE_URL,
);
