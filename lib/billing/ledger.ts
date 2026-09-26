// Cost tracking only — no credit gating in the open-source version.
// creditLedger table was removed from the schema; this module is a no-op stub
// so the billing import chain in trigger/chat.ts still compiles.

export { DOLLAR } from "@/lib/billing/format"

/** Free credits constant — kept for any consumers that reference it. */
export const FREE_CREDITS = 0n

/** No-op: always returns 0 — there is no credit ledger in the open-source version. */
export async function getCreditBalance(
  _orgId: string | null | undefined
): Promise<bigint> {
  return 0n
}

/** No-op: cost is logged by Trigger.dev telemetry, not stored locally. */
export async function chargeStep(_params: {
  orgId: string
  responseId: string
  amount: bigint
}): Promise<void> {
  // intentional no-op
}

/** Always returns true — no credit gate in the open-source version. */
export async function hasCreditsToBuild(_orgId: string): Promise<boolean> {
  return true
}

export const OUT_OF_CREDITS = ""
