import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { signupAction } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();

  if (session) {
    redirect("/posts");
  }

  const { error } = await searchParams;

  return (
    <main>
      <div className="site-shell">
        <h1 className="page-title">Create Account</h1>
        <p className="page-subtitle">
          Create a user account to sign in and join the platform.
        </p>

        <div className="form-card" style={{ maxWidth: "520px" }}>
          <form action={signupAction}>
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                Name
              </label>
              <input id="name" name="name" type="text" className="form-input" />
            </div>

            <div className="form-group">
              <label htmlFor="username" className="form-label">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email
              </label>
              <input id="email" name="email" type="email" className="form-input" />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
                className="form-input"
              />
            </div>

            {error ? (
              <p style={{ color: "#b91c1c", marginBottom: "1rem" }}>{error}</p>
            ) : null}

            <button type="submit" className="submit-button">
              Create Account
            </button>
          </form>
        </div>

        <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link href="/login" className="button-link secondary">
            Sign In
          </Link>
          <Link href="/" className="button-link secondary">
            Back Home
          </Link>
        </div>
      </div>
    </main>
  );
}
