"use client"

import { FlaskConicalIcon, MessageSquareIcon, SquarePenIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { SimulationMenu } from "@/components/simulation-menu"
import { Empty, EmptyDescription } from "@/components/ui/empty"
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import type { Simulation } from "@/lib/db/schema"

export function AppSidebar({
  simulations,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  simulations: Simulation[]
}) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="flex-row items-center justify-between group-data-[collapsible=icon]:justify-center">
        <Link
          href="/"
          className="flex items-center gap-2 group-data-[collapsible=icon]:hidden"
        >
          <Image
            src="/logo.svg"
            alt="Physics Simulation Lab"
            width={20}
            height={20}
            className="size-5"
          />
          <span className="font-logo text-base">Physics Lab</span>
        </Link>
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/"}
                render={<Link href="/" />}
              >
                <SquarePenIcon />
                <span>New simulation</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Recents</SidebarGroupLabel>
          <SidebarGroupContent>
            {simulations.length === 0 ? (
              <Empty className="border p-2 group-data-[collapsible=icon]:hidden">
                <EmptyDescription className="text-xs">
                  Your simulations will live here.
                </EmptyDescription>
              </Empty>
            ) : (
              <SidebarMenu className="group-data-[collapsible=icon]:hidden">
                {simulations.map((simulation) => (
                  <SidebarMenuItem key={simulation.id}>
                    <SidebarMenuButton
                      isActive={
                        pathname === `/simulations/${simulation.id}`
                      }
                      render={
                        <Link href={`/simulations/${simulation.id}`} />
                      }
                    >
                      <span>{simulation.title}</span>
                    </SidebarMenuButton>
                    <SimulationMenu
                      simulationId={simulation.id}
                      title={simulation.title}
                      trigger={<SidebarMenuAction showOnHover />}
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
            <SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
              <SidebarMenuItem>
                <Popover>
                  <PopoverTrigger
                    render={
                      <SidebarMenuButton>
                        <MessageSquareIcon />
                        <span>Recents</span>
                      </SidebarMenuButton>
                    }
                  />
                  <PopoverContent
                    side="right"
                    align="start"
                    className="w-56 gap-1.5 p-1.5"
                  >
                    <PopoverHeader className="px-2 pt-1">
                      <PopoverTitle className="text-xs text-muted-foreground">
                        Recents
                      </PopoverTitle>
                    </PopoverHeader>
                    {simulations.length === 0 ? (
                      <Empty className="border p-2">
                        <EmptyDescription className="text-xs">
                          Your simulations will live here.
                        </EmptyDescription>
                      </Empty>
                    ) : (
                      <SidebarMenu>
                        {simulations.map((simulation) => (
                          <SidebarMenuItem key={simulation.id}>
                            <PopoverClose
                              nativeButton={false}
                              render={
                                <SidebarMenuButton
                                  isActive={
                                    pathname ===
                                    `/simulations/${simulation.id}`
                                  }
                                  render={
                                    <Link
                                      href={`/simulations/${simulation.id}`}
                                    />
                                  }
                                >
                                  <span>{simulation.title}</span>
                                </SidebarMenuButton>
                              }
                            />
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    )}
                  </PopoverContent>
                </Popover>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-center px-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <FlaskConicalIcon className="size-4 text-muted-foreground" />
          <span className="ml-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            Physics Simulation Lab
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
