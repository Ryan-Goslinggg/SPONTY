import { existsSync, readFileSync } from "node:fs";

/** A tiny cookie-keeping HTTP client that can also call Next.js server actions by name. */
export class Client {
  cookies = new Map<string, string>();

  constructor(
    readonly base: string,
    readonly label: string,
  ) {}

  cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  async fetch(path: string, init: RequestInit & { origin?: string | null } = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.cookies.size && !headers.has("cookie")) headers.set("cookie", this.cookieHeader());
    // Browsers send Origin on POST; attacks override or remove it.
    if (init.origin !== null && !headers.has("origin")) headers.set("origin", init.origin ?? this.base);
    const res = await fetch(new URL(path, this.base), { ...init, headers, redirect: "manual" });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1);
      if (value === "" || /max-age=0/i.test(c)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return res;
  }

  async postJson(path: string, body: unknown, init: RequestInit & { origin?: string | null } = {}) {
    return this.fetch(path, {
      ...init,
      method: "POST",
      headers: { "content-type": "application/json", ...(init.headers as Record<string, string>) },
      body: JSON.stringify(body),
    });
  }

  async signUp(name: string, email: string, password: string) {
    return this.postJson("/api/auth/sign-up/email", { name, email, password });
  }

  async signIn(email: string, password: string, headers?: Record<string, string>) {
    return this.postJson("/api/auth/sign-in/email", { email, password }, { headers });
  }

  /** Calls a server action the way the browser does. Returns the action's value, or `{ thrown }` if it threw. */
  async action<T = unknown>(name: string, ...args: unknown[]): Promise<T | { thrown: string }> {
    const res = await this.fetch("/", {
      method: "POST",
      headers: {
        "next-action": actionId(name),
        "content-type": "text/plain;charset=UTF-8",
        accept: "text/x-component",
      },
      body: JSON.stringify(args),
    });
    return parseActionResponse<T>(await res.text());
  }
}

export function parseActionResponse<T>(text: string): T | { thrown: string } {
  for (const line of text.split("\n")) {
    const m = /^[0-9a-f]+:(E?)(\{.*\})$/.exec(line);
    if (!m) continue;
    let value: Record<string, unknown>;
    try {
      value = JSON.parse(m[2]);
    } catch {
      continue;
    }
    if (m[1] === "E") return { thrown: String(value.message ?? "error") };
    if ("ok" in value) return value as T;
  }
  return { thrown: `unparseable response: ${text.slice(0, 120)}` };
}

let ids: Map<string, string> | null = null;

/** Action ids come from the build's manifest, so the dev server must have compiled the home page. */
export function actionId(name: string): string {
  if (!ids) {
    const candidates = [
      ".next/dev/server/app/(app)/page/server-reference-manifest.json",
      ".next/server/app/(app)/page/server-reference-manifest.json",
    ];
    const file = candidates.find((f) => existsSync(f));
    if (!file) throw new Error("No server action manifest found. Open the app once (signed in) so Next compiles it.");
    const manifest = JSON.parse(readFileSync(file, "utf8")) as { node: Record<string, { exportedName: string }> };
    ids = new Map(Object.entries(manifest.node).map(([id, v]) => [v.exportedName, id]));
  }
  const id = ids.get(name);
  if (!id) throw new Error(`Unknown server action ${name}`);
  return id;
}

export function resetActionIds() {
  ids = null;
}
