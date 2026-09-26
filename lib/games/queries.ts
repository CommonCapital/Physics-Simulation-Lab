// Redirects to the new location. lib/games/ is kept for backward compatibility
// with any external references; all canonical code is now in lib/physics-lab/.
export * from "@/lib/physics-lab/queries"
// Aliases for old names
export { listSimulations as listGames, getSimulation as getGame } from "@/lib/physics-lab/queries"
