import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const inputVariants = cva(
  "w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-card dark:aria-invalid:border-destructive/60",
  {
    variants: {
      fieldSize: {
        compact: "h-9",
        default: "h-10",
        large: "h-12 text-[0.9375rem] md:text-[0.9375rem]",
      },
    },
    defaultVariants: { fieldSize: "default" },
  },
)

function Input({ className, type, fieldSize, ...props }: React.ComponentProps<"input"> & VariantProps<typeof inputVariants>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(inputVariants({ fieldSize }), className)}
      {...props}
    />
  )
}

export { Input, inputVariants }
