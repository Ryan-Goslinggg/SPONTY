import { initials } from "@/lib/format";
import type { User } from "@/lib/types";

export function Avatar({ user, size = 40, ring = false }: { user: Pick<User, "name" | "tint">; size?: number; ring?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-extrabold text-ink ${ring ? "ring-2 ring-mint-400 ring-offset-2 ring-offset-white" : ""}`}
      style={{ width: size, height: size, background: user.tint, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials(user.name)}
    </span>
  );
}
