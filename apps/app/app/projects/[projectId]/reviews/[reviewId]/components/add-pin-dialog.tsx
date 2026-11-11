'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from '@markerit/ui';
import type { TranslationMessages } from '@markerit/i18n';
import { AttachmentField } from './attachment-field';

export type PinPoint = { xPercent: number; yPercent: number };

export interface AddPinDialogProps {
  open: boolean;
  point: PinPoint | null;
  messages: TranslationMessages;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: string, files: File[]) => Promise<string | null>;
}

export function AddPinDialog({
  open,
  point,
  messages,
  onOpenChange,
  onSubmit,
}: AddPinDialogProps) {
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setBody('');
      setFiles([]);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) {
      setError(messages.project.commentRequired);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const submitError = await onSubmit(body.trim(), files);
      if (submitError) {
        setError(submitError);
        return;
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  const coordinates = point
    ? `${point.xPercent.toFixed(1)}% / ${point.yPercent.toFixed(1)}%`
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="size-4 text-primary" />
              {messages.project.addPinTitle}
            </DialogTitle>
            <DialogDescription>
              {messages.project.addPinDescription}{' '}
              {point && <span className="font-medium text-foreground">{coordinates}</span>}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="pin-body">{messages.project.pinBodyLabel}</Label>
            <Textarea
              id="pin-body"
              value={body}
              maxLength={20_000}
              placeholder={messages.project.pinBodyPlaceholder}
              onChange={(event) => {
                setBody(event.target.value);
                if (error) setError(null);
              }}
            />
          </div>

          <AttachmentField messages={messages} files={files} onChange={setFiles} />

          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {messages.project.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={submitting} className="gap-1.5">
              <MapPin className="size-3.5" />
              {submitting ? messages.project.addingPin : messages.project.addPinAction}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
