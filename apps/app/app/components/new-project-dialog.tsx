'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@markerit/ui';
import { projectNameSchema } from '@markerit/validators';
import { useAppLocale } from '../lib/use-app-locale';
import type { ProjectTone } from './types';
import { cn } from 'cn';

export interface NewProjectValues {
  name: string;
  description?: string;
  tone: ProjectTone;
}

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceName?: string;
  onCreateProject: (values: NewProjectValues) => Promise<boolean>;
}

const colorTones: { id: ProjectTone; label: string; bg: string }[] = [
  { id: 'sage', label: 'Szałwia', bg: 'bg-emerald-400' },
  { id: 'sand', label: 'Piasek', bg: 'bg-amber-400' },
  { id: 'blue', label: 'Błękit', bg: 'bg-sky-400' },
  { id: 'lilac', label: 'Liliowy', bg: 'bg-purple-400' },
  { id: 'emerald', label: 'Szmaragd', bg: 'bg-green-500' },
  { id: 'amber', label: 'Bursztyn', bg: 'bg-orange-400' },
];

export function NewProjectDialog({
  open,
  onOpenChange,
  workspaceName = 'Moja przestrzeń',
  onCreateProject,
}: NewProjectDialogProps) {
  const { messages } = useAppLocale();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tone, setTone] = useState<ProjectTone>('sage');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName('');
    setDescription('');
    setTone('sage');
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = projectNameSchema.safeParse(name);
    if (!result.success) {
      setError(result.error.issues[0]?.message || 'Podaj poprawną nazwę projektu (3-50 znaków).');
      return;
    }

    setSubmitting(true);
    try {
      const created = await onCreateProject({
        name: result.data,
        description: description.trim() || undefined,
        tone,
      });
      if (!created) {
        setError('Nie udało się utworzyć projektu. Spróbuj ponownie.');
        return;
      }
      reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" closeLabel={messages.project.close}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Utwórz nowy projekt</DialogTitle>
              <DialogDescription>
                Projekt zostanie dodany do przestrzeni „{workspaceName}”. Później dodasz zdjęcia do
                review i zaczniesz zbierać uwagi.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-1">
              <div className="space-y-1.5">
                <Label htmlFor="project-name">Nazwa projektu *</Label>
                <Input
                  id="project-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="np. Identyfikacja marki 2026"
                  autoFocus
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="project-desc">Krótki opis (opcjonalnie)</Label>
                <Input
                  id="project-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="np. Przygotowanie materiałów social media i bannerów"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Kolor miniatury projektu</Label>
                <div className="flex items-center gap-2 pt-1">
                  {colorTones.map((c) => (
                    <Tooltip key={c.id}>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setTone(c.id)}
                            aria-label={c.label}
                            className={cn(
                              'size-7 rounded-full p-0 transition-all hover:bg-transparent',
                              c.bg,
                              tone === c.id
                                ? 'scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background'
                                : 'opacity-80 hover:opacity-100'
                            )}
                          />
                        }
                      />
                      <TooltipContent side="bottom">{c.label}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Anuluj
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? 'Tworzenie...' : 'Utwórz projekt'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
