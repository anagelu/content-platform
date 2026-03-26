"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function loginAction(
  _prevState: { error: string },
  formData: FormData,
) {
  const username = formData.get("username")?.toString().trim() || "";
  const password = formData.get("password")?.toString() || "";

  try {
    await signIn("credentials", {
      username,
      password,
      redirectTo: "/posts",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: "Invalid username or password",
      };
    }

    throw error;
  }

  return {
    error: "",
  };
}
