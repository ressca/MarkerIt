'use client';

import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
  Separator,
  Input,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@markerit/ui';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import type { Workspace } from './types';
import { cn } from 'cn';

interface WorkspaceSwitcherProps {
  workspaces?: Workspace[];
  currentWorkspaceId?: string;
  onSelectWorkspace?: (workspaceId: string) => void;
  onAddWorkspace?: (name: string) => void;
  collapsed?: boolean;
}

export function WorkspaceSwitcher({
  workspaces = [],
  currentWorkspaceId,
  onSelectWorkspace,
  onAddWorkspace,
  collapsed = false,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newWsName, setNewWsName] = useState('');

  const list = workspaces.length > 0
    ? workspaces
    : [
        {
          id: 'ws-1',
          name: 'Moja przestrzeń',
          role: 'Właściciel',
          initials: 'MP',
          isDefault: true,
        },
      ];

  const activeWs = list.find((w) => w.id === currentWorkspaceId) || list[0];

  function handleSelect(workspaceId: string) {
    onSelectWorkspace?.(workspaceId);
    setOpen(false);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newWsName.trim()) return;
    onAddWorkspace?.(newWsName.trim());
    setNewWsName('');
    setIsAdding(false);
    setOpen(false);
  }

  if (collapsed) {
    return (
      <TooltipProvider>
        <Popover open={open} onOpenChange={setOpen}>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      className="size-10 rounded-lg bg-card/80"
                      aria-label={`Przestrzeń: ${activeWs.name}`}
                    />
                  }
                >
                  <span className="font-bold text-xs text-primary">{activeWs.initials}</span>
                </PopoverTrigger>
              }
            />
            <TooltipContent side="right">
              <p className="font-semibold">{activeWs.name}</p>
              <p className="text-[10px] text-muted-foreground">{activeWs.role}</p>
            </TooltipContent>
          </Tooltip>

          <PopoverContent align="start" side="right" className="w-64 p-2 shadow-xl">
            <div className="px-2 py-1.5 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
              Twoje przestrzenie robocze
            </div>
            <div className="flex flex-col gap-0.5">
              {list.map((ws) => {
                const isCurrent = ws.id === activeWs.id;
                return (
                  <Button
                    key={ws.id}
                    type="button"
                    variant="ghost"
                    onClick={() => handleSelect(ws.id)}
                    className={cn(
                      'h-auto w-full items-center justify-between px-2.5 py-2 text-left text-xs',
                      isCurrent
                        ? 'bg-primary/10 font-semibold text-primary hover:bg-primary/15'
                        : 'text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-6 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
                        {ws.initials}
                      </span>
                      <div>
                        <span className="block truncate max-w-[140px]">{ws.name}</span>
                        <span className="block text-[10px] text-muted-foreground">{ws.role}</span>
                      </div>
                    </div>
                    {isCurrent && <Check className="size-3.5 shrink-0 text-primary" />}
                  </Button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </TooltipProvider>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="h-auto w-full items-center justify-between gap-3 bg-card/60 p-2.5 text-left"
            aria-label="Wybierz przestrzeń roboczą"
          />
        }
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 font-bold text-xs text-primary ring-1 ring-primary/20">
            {activeWs.initials}
          </div>
          <div className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-xs text-foreground">
              {activeWs.name}
            </span>
            <span className="block text-[11px] text-muted-foreground">{activeWs.role}</span>
          </div>
        </div>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-2 shadow-xl">
        <div className="px-2 py-1.5 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
          Przestrzenie robocze
        </div>
        <div className="flex flex-col gap-0.5">
          {list.map((ws) => {
            const isCurrent = ws.id === activeWs.id;
            return (
              <Button
                key={ws.id}
                type="button"
                variant="ghost"
                onClick={() => handleSelect(ws.id)}
                className={cn(
                  'h-auto w-full items-center justify-between px-2.5 py-2 text-left text-xs',
                  isCurrent
                    ? 'bg-primary/10 font-semibold text-primary hover:bg-primary/15'
                    : 'text-foreground'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-6 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
                    {ws.initials}
                  </span>
                  <div>
                    <span className="block truncate max-w-[140px]">{ws.name}</span>
                    <span className="block text-[10px] text-muted-foreground">{ws.role}</span>
                  </div>
                </div>
                {isCurrent && <Check className="size-3.5 shrink-0 text-primary" />}
              </Button>
            );
          })}
        </div>

        <Separator className="my-2" />

        {isAdding ? (
          <form onSubmit={handleCreate} className="flex flex-col gap-2 p-1">
            <Input
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              placeholder="Nazwa nowej przestrzeni"
              className="h-8 text-xs"
              autoFocus
            />
            <div className="flex justify-end gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setIsAdding(false)}
              >
                Anuluj
              </Button>
              <Button type="submit" size="sm" className="h-7 px-2.5 text-xs">
                Dodaj
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="size-3.5" />
            Nowa przestrzeń...
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
