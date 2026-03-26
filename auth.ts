import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { syncEnvAdminUser } from "@/lib/admin-user";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/passwords";

export const { handlers, signIn, signOut, auth } = NextAuth({
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!username || !password) {
          return null;
        }

        await syncEnvAdminUser();

        const user = await prisma.user.findUnique({
          where: {
            username,
          },
        });

        if (user && verifyPassword(password, user.passwordHash)) {
          return {
            id: String(user.id),
            name: user.name ?? user.username,
            email: user.email,
            role: user.role === "ADMIN" ? "admin" : "user",
          };
        }

        if (
          username === process.env.ADMIN_USERNAME &&
          password === process.env.ADMIN_PASSWORD
        ) {
          return {
            id: "admin",
            name: "Admin",
            email: "admin@local.dev",
            role: "admin",
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.role = token.role ?? "user";
      }

      return session;
    },
  },
});
