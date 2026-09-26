import "server-only"

import { desc, eq } from "drizzle-orm"

import { db, simulations, type Simulation } from "@/lib/db"

/**
 * All simulations, newest first.
 */
export async function listSimulations(): Promise<Simulation[]> {
  return db.select().from(simulations).orderBy(desc(simulations.createdAt))
}

// Postgres rejects a malformed uuid with an error rather than an empty result,
// so bad ids from the URL are filtered out before they reach the query.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A single simulation by id, or `undefined` when it doesn't exist.
 */
export async function getSimulation(
  id: string
): Promise<Simulation | undefined> {
  if (!UUID_RE.test(id)) {
    return undefined
  }

  const [simulation] = await db
    .select()
    .from(simulations)
    .where(eq(simulations.id, id))
    .limit(1)

  return simulation
}
