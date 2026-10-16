import { isDemoUser } from "@/lib/demo";

/** Marks made-up demo people and their content so nothing passes as a real review. */
export function DemoBadge({ userId }: { userId: string }) {
  if (!isDemoUser(userId)) return null;
  return (
    <span
      className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900"
      title="Made-up example content"
    >
      demo
    </span>
  );
}
