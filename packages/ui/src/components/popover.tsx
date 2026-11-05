import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { cn } from "cn"

function Popover(props: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger(props: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({ className, align = "center", side = "bottom", sideOffset = 8, ...props }: PopoverPrimitive.Popup.Props & {
  align?: PopoverPrimitive.Positioner.Props["align"]
  side?: PopoverPrimitive.Positioner.Props["side"]
  sideOffset?: number
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner align={align} side={side} sideOffset={sideOffset} className="z-50">
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "z-50 w-72 origin-[var(--transform-origin)] rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg outline-none data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95",
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverContent, PopoverTrigger }
