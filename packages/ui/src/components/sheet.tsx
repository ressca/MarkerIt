'use client';

import * as React from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { XIcon } from 'lucide-react';
import { cn } from 'cn';

function Sheet(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetContent({
  className,
  children,
  side = 'left',
  showClose = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  side?: 'left' | 'right';
  showClose?: boolean;
}) {
  return (
    <DialogPrimitive.Portal data-slot="sheet-portal">
      <DialogPrimitive.Backdrop
        data-slot="sheet-backdrop"
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
      />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          'fixed inset-y-0 z-50 flex h-full w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-300 ease-in-out',
          side === 'left'
            ? 'left-0 border-r border-border data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full'
            : 'right-0 border-l border-border data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full',
          className
        )}
        {...props}
      >
        {children}
        {showClose && (
          <SheetClose
            data-slot="sheet-close-button"
            className="absolute top-3.5 right-3.5 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Zamknij"
          >
            <XIcon className="size-4" />
          </SheetClose>
        )}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent };
