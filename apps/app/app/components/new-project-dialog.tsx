'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@markerit/ui';
import { Button } from '@markerit/ui/components/button';
import { Input } from '@markerit/ui/components/input';
import { Label } from '@markerit/ui/components/label';
import type { Project, ProjectTone } from './types';
import { cn } from 'cn';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultWorkspace?: string;
  onCreateProject: (project: Omit<Project, 'id' | 'updated'>) => void;
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
  defaultWorkspace = 'Studio Północ',
  onCreateProject,
}: NewProjectDialogProps) {
  const [name, setName] = useState('');
  const [workspace, setWorkspace] = useState(defaultWorkspace);
  const [description, setDescription] = useState('');
  const [tone, setTone] = useState<ProjectTone>('sage');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Wprowadź nazwę projektu');
      return;
    }

    onCreateProject({
      name: name.trim(),
      workspace,
      description: description.trim() || undefined,
      tone,
      status: 'W toku',
      count: 0,
      members: [{ name: 'Anna Kowalska', initials: 'AK' }],
    });

    setName('');
    setDescription('');
    setTone('sage');
    setError('');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Utwórz nowy projekt</DialogTitle>
            <DialogDescription>
              Stwórz projekt, dodaj pliki wizualne i zacznij zbierać precyzyjny feedback z zespołem.
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
                placeholder="np. Kampania letnia 2026"
                autoFocus
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project-workspace">Przestrzeń robocza</Label>
              <Input
                id="project-workspace"
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                placeholder="Studio Północ"
              />
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
              <Label>Kolor przewodni miniatury</Label>
              <div className="flex items-center gap-2 pt-1">
                {colorTones.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setTone(c.id)}
                    aria-label={c.label}
                    title={c.label}
                    className={cn(
                      'size-7 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      c.bg,
                      tone === c.id
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110'
                        : 'opacity-80 hover:opacity-100'
                    )}
                  />
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
            <Button type="submit" size="sm">
              Utwórz projekt
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
