import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const session = await auth();

  if (session) {
    redirect("/posts");
  }

  const { success } = await searchParams;

  return (
    <main>
      <div className="site-shell">
        <h1 className="page-title">Sign In</h1>
        <p className="page-subtitle">
          Sign in to your account to create, edit, and manage posts.
        </p>

        <LoginForm successMessage={success} />

        <div style={{ marginTop: "1.25rem" }}>
          <Link href="/signup" className="button-link" style={{ marginRight: "0.75rem" }}>
            Create Account
          </Link>
          <Link href="/" className="button-link secondary">
            Back Home
          </Link>
        </div>
      </div>
    </main>
  );
}
