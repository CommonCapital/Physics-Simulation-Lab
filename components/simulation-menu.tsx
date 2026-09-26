"use client"

import { EllipsisIcon, PencilLineIcon, Trash2Icon } from "lucide-react"
import { usePathname } from "next/navigation"
import { useState, useTransition } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  deleteSimulation,
  renameSimulation,
} from "@/lib/physics-lab/actions"
import { TITLE_MAX_LENGTH } from "@/lib/physics-lab/title"

export function SimulationMenu({
  simulationId,
  title,
  trigger,
}: {
  simulationId: string
  title: string
  trigger?: React.ReactElement
}) {
  const pathname = usePathname()
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null)
  const [name, setName] = useState(title)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function openDialog(next: "rename" | "delete") {
    setName(title)
    setError(null)
    setDialog(next)
  }

  function handleOpenChange(open: boolean) {
    if (!open && !isPending) {
      setDialog(null)
    }
  }

  function handleRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        await renameSimulation(simulationId, name)
        setDialog(null)
      } catch {
        setError("That name could not be saved. Try again.")
      }
    })
  }

  function handleDelete() {
    setError(null)

    startTransition(async () => {
      try {
        await deleteSimulation(
          simulationId,
          pathname === `/simulations/${simulationId}`
        )
      } catch {
        setError("This simulation could not be deleted. Try again.")
      }
    })
  }

  const trimmed = name.trim()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Options for ${title}`}
          render={trigger ?? <Button variant="ghost" size="icon-sm" />}
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => openDialog("rename")}>
            <PencilLineIcon />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => openDialog("delete")}
          >
            <Trash2Icon />
            Move to trash
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "rename"} onOpenChange={handleOpenChange}>
        <DialogContent>
          <form onSubmit={handleRename} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Rename simulation</DialogTitle>
              <DialogDescription>
                This is the name in the sidebar and above the thread. It does
                not change the simulation itself.
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="simulation-title">Name</FieldLabel>
              <Input
                id="simulation-title"
                name="title"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={TITLE_MAX_LENGTH}
                disabled={isPending}
                autoFocus
              />
            </Field>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                disabled={!trimmed || isPending}
                focusableWhenDisabled
              >
                {isPending && <Spinner />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialog === "delete"} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2Icon className="text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>Move "{title}" to trash?</AlertDialogTitle>
            <AlertDialogDescription>
              The thread and the sandbox it was built in go with it. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
              focusableWhenDisabled
            >
              {isPending && <Spinner />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
