import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const outputDir = path.resolve(process.cwd(), "playwright-screenshots");

const routes = [
  { route: "/", fileName: "home.png" },
  { route: "/posts", fileName: "posts.png" },
  { route: "/books/new", fileName: "new-book.png" },
  { route: "/trading/algo", fileName: "trading-algo.png" },
];

async function main() {
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1200 },
    });

    for (const { route, fileName } of routes) {
      const url = new URL(route, baseUrl).toString();
      const outputPath = path.join(outputDir, fileName);

      try {
        await page.goto(url, { waitUntil: "networkidle" });
        await page.screenshot({ path: outputPath, fullPage: true });
        console.log(`SUCCESS ${route} -> ${fileName}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`FAIL ${route} -> ${fileName}: ${message}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : error;
  console.error("Screenshot script failed to start:", message);
  process.exitCode = 1;
});
