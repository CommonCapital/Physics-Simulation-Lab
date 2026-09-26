import Image from "next/image"

import { NewSimulationComposer } from "@/components/new-simulation-composer"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export default async function Page() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6">
      <Empty className="flex-none">
        <EmptyHeader>
          <EmptyMedia>
            <Image src="/logo.svg" alt="Logo" width={48} height={48} />
          </EmptyMedia>
          <EmptyTitle className="text-2xl">
            What should we simulate today?
          </EmptyTitle>
          <EmptyDescription>
            Describe a physical scenario in your own words — phenomenon,
            geometry, values, units — and get a running simulation grounded in
            real physics, with its governing equations, assumptions, and limits
            stated alongside every number.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="max-w-2xl gap-6">
          <NewSimulationComposer />
        </EmptyContent>
      </Empty>
    </div>
  )
}
