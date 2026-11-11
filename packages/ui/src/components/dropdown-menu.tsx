'use client';

import * as React from 'react';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import { cn } from 'cn';

function DropdownMenu(props: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger(props: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuPortal(props: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuContent({
  className,
  align = 'end',
  side = 'bottom',
  sideOffset = 6,
  ...props
}: MenuPrimitive.Popup.Props & {
  align?: MenuPrimitive.Positioner.Props['align'];
  side?: MenuPrimitive.Positioner.Props['side'];
  sideOffset?: number;
}) {
  return (
    <DropdownMenuPortal>
      <MenuPrimitive.Positioner align={align} side={side} sideOffset={sideOffset} className="z-50">
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            'z-50 min-w-44 origin-[var(--transform-origin)] overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95',
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </DropdownMenuPortal>
  );
}

function DropdownMenuGroup(props: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuLabel({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dropdown-menu-label"
      className={cn(
        'px-2 py-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase',
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        'flex cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground outline-none transition-colors select-none data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-3.5',
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        'flex cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground outline-none transition-colors select-none data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn('-mx-1.5 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn('ml-auto text-[10px] tracking-widest text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
};
