"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

type LoginState = {
  error: string;
};

const initialState: LoginState = {
  error: "",
};

export function LoginForm({
  successMessage,
}: {
  successMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="form-card" style={{ maxWidth: "520px" }}>
      <form action={formAction}>
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
          <label htmlFor="password" className="form-label">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="form-input"
          />
        </div>

        {successMessage ? (
          <p style={{ color: "#166534", marginBottom: "1rem" }}>{successMessage}</p>
        ) : null}

        {state.error ? (
          <p style={{ color: "#b91c1c", marginBottom: "1rem" }}>{state.error}</p>
        ) : null}

        <button type="submit" className="submit-button" disabled={pending}>
          {pending ? "Signing In..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
