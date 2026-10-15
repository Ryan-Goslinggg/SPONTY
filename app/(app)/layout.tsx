import { redirect } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { getSessionUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { loadSnapshot } from "@/lib/server/queries";
import { StoreProvider } from "@/lib/store";

/** Everything behind sign-in. The first screen arrives with the user's data already loaded. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  const snapshot = await loadSnapshot(getDb(), user);

  return (
    <StoreProvider initial={snapshot}>
      <main className="mx-auto min-h-dvh w-full max-w-md px-4">{children}</main>
      <BottomNav />
    </StoreProvider>
  );
}
