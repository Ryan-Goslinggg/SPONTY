import { getAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

export function GET(req: Request) {
  return getAuth().handler(req);
}

export function POST(req: Request) {
  return getAuth().handler(req);
}
