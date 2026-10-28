import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function TradingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (session?.user?.role !== "admin") {
    redirect("/");
  }

  return <>{children}</>;
}
