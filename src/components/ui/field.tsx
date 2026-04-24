import * as React from "react"
import { cn } from "@/lib/utils"

function FieldGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="field-group"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  )
}

function Field({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="field"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  )
}

function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="field-label"
      className={cn(
        "text-sm font-medium leading-none text-[var(--color-text-primary)] select-none",
        className
      )}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        "text-[length:var(--text-xs)] text-[var(--color-text-tertiary)] leading-snug",
        className
      )}
      {...props}
    />
  )
}

export { Field, FieldGroup, FieldLabel, FieldDescription }
