import React from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { listSimulations } from "@/lib/physics-lab/queries"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const simulations = await listSimulations()

  return (
    <SidebarProvider>
      <AppSidebar simulations={simulations} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
