import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-stone-200 border-transparent px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-stone-950 focus-visible:ring-stone-950/50 focus-visible:ring-[3px] aria-invalid:ring-red-500/20 dark:aria-invalid:ring-red-500/40 aria-invalid:border-red-500 transition-[color,box-shadow] overflow-hidden dark:border-stone-800 dark:focus-visible:border-stone-300 dark:focus-visible:ring-stone-300/50 dark:aria-invalid:ring-red-900/20 dark:dark:aria-invalid:ring-red-900/40 dark:aria-invalid:border-red-900",
  {
    variants: {
      variant: {
        default: "bg-stone-900 text-stone-50 [a&]:hover:bg-stone-900/90 dark:bg-stone-50 dark:text-stone-900 dark:[a&]:hover:bg-stone-50/90",
        secondary:
          "bg-stone-100 text-stone-900 [a&]:hover:bg-stone-100/90 dark:bg-stone-800 dark:text-stone-50 dark:[a&]:hover:bg-stone-800/90",
        destructive:
          "bg-red-500 text-white [a&]:hover:bg-red-500/90 focus-visible:ring-red-500/20 dark:focus-visible:ring-red-500/40 dark:bg-red-500/60 dark:bg-red-900 dark:[a&]:hover:bg-red-900/90 dark:focus-visible:ring-red-900/20 dark:dark:focus-visible:ring-red-900/40 dark:dark:bg-red-900/60",
        outline:
          "border-stone-200 text-stone-950 [a&]:hover:bg-stone-100 [a&]:hover:text-stone-900 dark:border-stone-800 dark:text-stone-50 dark:[a&]:hover:bg-stone-800 dark:[a&]:hover:text-stone-50",
        ghost: "[a&]:hover:bg-stone-100 [a&]:hover:text-stone-900 dark:[a&]:hover:bg-stone-800 dark:[a&]:hover:text-stone-50",
        link: "text-stone-900 underline-offset-4 [a&]:hover:underline dark:text-stone-50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
