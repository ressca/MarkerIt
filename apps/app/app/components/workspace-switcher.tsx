'use client';

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@markerit/ui';
import { Button } from '@markerit/ui/components/button';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from 'cn';

const workspaces = [
  { id: 'sp', name: 'Studio Północ', role: 'Właściciel', initials: 'SP', active: true },
  { id: 'po', name: 'Projekt osobisty', role: 'Darmowy', initials: 'PO', active: false },
  { id: 'kf', name: 'Klient: Fashion Lab', role: 'Edytor', initials: 'KF', active: false },
];

export function WorkspaceSwitcher({
  currentWorkspace = 'Studio Północ',
  onSelectWorkspace,
}: {
  currentWorkspace?: string;
  onSelectWorkspace?: (workspace: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(currentWorkspace);

  const activeWs = workspaces.find((w) => w.name === selected) || {
    id: 'sp',
    name: selected,
    role: 'Workspace',
    initials: selected.slice(0, 2).toUpperCase(),
  };

  function handleSelect(name: string) {
    setSelected(name);
    onSelectWorkspace?.(name);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card/60 p-2.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

      <PopoverContent align="start" className="w-64 p-1.5 shadow-xl">
        <div className="px-2 py-1.5 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
          Przestrzenie robocze
        </div>
        <div className="flex flex-col gap-0.5">
          {workspaces.map((ws) => {
            const isCurrent = ws.name === selected;
            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => handleSelect(ws.name)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors',
                  isCurrent
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-6 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
                    {ws.initials}
                  </span>
                  <div>
                    <span className="block">{ws.name}</span>
                    <span className="block text-[10px] text-muted-foreground">{ws.role}</span>
                  </div>
                </div>
                {isCurrent && <Check className="size-3.5 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>

        <div className="my-1.5 h-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(false)}
        >
          <Plus className="size-3.5" />
          Nowa przestrzeń...
        </Button>
      </PopoverContent>
    </Popover>
  );
}
