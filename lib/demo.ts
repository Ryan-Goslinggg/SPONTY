/**
 * The made-up people that `npm run db:seed` loads (see scripts/demo-data.ts).
 * Their posts and reviews are shown with a "demo" badge so nothing made up
 * passes as a real person or a real review.
 */
export const DEMO_USER_IDS: ReadonlySet<string> = new Set([
  "u_mika",
  "u_paolo",
  "u_andrea",
  "u_jules",
  "u_bea",
  "u_carlo",
  "u_nina",
  "u_tess",
  "u_rafa",
  "u_leo",
]);

export const isDemoUser = (id: string) => DEMO_USER_IDS.has(id);
