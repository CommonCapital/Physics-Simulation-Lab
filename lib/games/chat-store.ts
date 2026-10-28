// Redirects to the new location.
export * from "@/lib/physics-lab/chat-store"
export { loadSimulationMessages as loadGameMessages, saveSimulationMessages as saveGameMessages, saveSimulationTurn as saveGameTurn } from "@/lib/physics-lab/chat-store"

// loadGameOrgId no longer exists — orgId was removed from the schema.
// Kept as a stub returning undefined so old code that calls it doesn't crash.
export async function loadGameOrgId(_gameId: string): Promise<string | undefined> {
  return undefined
}
