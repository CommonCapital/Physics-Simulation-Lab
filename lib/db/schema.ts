import type { UIMessage } from "ai"
import { sql } from "drizzle-orm"
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

export const simulations = pgTable(
  "simulations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    // The simulation's chat thread, in the `useChat` UI message format.
    messages: jsonb("messages")
      .$type<UIMessage[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    // Trigger.dev chat session state for the thread above.
    chatAccessToken: text("chat_access_token"),
    chatLastEventId: text("chat_last_event_id"),
    // The Daytona sandbox the simulation is built in.
    sandboxId: text("sandbox_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("simulations_created_at_idx").on(table.createdAt.desc()),
  ]
)

export type Simulation = typeof simulations.$inferSelect
export type NewSimulation = typeof simulations.$inferInsert

// ---------------------------------------------------------------------------
// Backward-compatible re-exports so any code still importing "games" compiles.
// Remove these once all callers are updated.
// ---------------------------------------------------------------------------
export const games = simulations
export type Game = Simulation
export type NewGame = NewSimulation
