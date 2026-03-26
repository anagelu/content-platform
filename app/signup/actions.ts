"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/passwords";
import { redirect } from "next/navigation";

export async function signupAction(formData: FormData) {
  const name = formData.get("name")?.toString().trim() || "";
  const username = formData.get("username")?.toString().trim() || "";
  const email = formData.get("email")?.toString().trim() || "";
  const password = formData.get("password")?.toString() || "";

  if (!username || !password) {
    redirect("/signup?error=Username%20and%20password%20are%20required");
  }

  if (password.length < 8) {
    redirect("/signup?error=Password%20must%20be%20at%20least%208%20characters");
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { username },
        ...(email ? [{ email }] : []),
      ],
    },
  });

  if (existingUser) {
    redirect("/signup?error=That%20username%20or%20email%20is%20already%20taken");
  }

  await prisma.user.create({
    data: {
      name: name || null,
      username,
      email: email || null,
      passwordHash: hashPassword(password),
      role: "USER",
    },
  });

  redirect("/login?success=Account%20created.%20Please%20sign%20in.");
}
