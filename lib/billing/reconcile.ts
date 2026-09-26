// No-op stub — Clerk billing has been removed from the open-source version.
// This file is kept so any existing import of reconcileCredits still compiles.

/** No-op: credit reconciliation against a subscription is not applicable. */
export async function reconcileCredits(_orgId: string): Promise<void> {
  // intentional no-op
}
