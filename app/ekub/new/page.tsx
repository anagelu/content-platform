import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createEkubGroup } from "../actions";
import { EkubGroupForm } from "../ekub-group-form";

export default async function NewEkubPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <main>
      <div className="site-shell">
        <h1 className="page-title">Create Ekub Group</h1>
        <p className="page-subtitle">
          Set the contribution amount, choose the cycle rhythm, and decide whether the pot rotates in fixed order or by random draw.
        </p>

        <div className="toolbar">
          <Link href="/ekub" className="button-link secondary">
            Back to Ekub
          </Link>
        </div>

        <EkubGroupForm submitAction={createEkubGroup} />
      </div>
    </main>
  );
}
