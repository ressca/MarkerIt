'use client';

import { useId, useState } from 'react';
import { Send } from 'lucide-react';
import { Button, Label, Textarea } from '@markerit/ui';
import type { TranslationMessages } from '@markerit/i18n';
import { AttachmentField } from './attachment-field';

export interface CommentComposerProps {
  messages: TranslationMessages;
  disabled?: boolean;
  placeholder: string;
  submitLabel: string;
  label: string;
  onSubmit: (body: string, files: File[]) => Promise<string | null>;
  onDone?: () => void;
  onCancel?: () => void;
  testId?: string;
}

/**
 * Shared body + attachment form used when creating a pin, replying to a
 * comment and adding a comment to an existing pin.
 */
export function CommentComposer({
  messages,
  disabled = false,
  placeholder,
  submitLabel,
  label,
  onSubmit,
  onDone,
  onCancel,
  testId,
}: CommentComposerProps) {
  const id = useId();
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (disabled || submitting) return;
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
      setBody('');
      setFiles([]);
      onDone?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid={testId}
      className="space-y-2 rounded-lg border border-border bg-card p-2.5"
    >
      <div className="space-y-1">
        <Label htmlFor={id} className="text-[11px] font-medium text-muted-foreground">
          {label}
        </Label>
        <Textarea
          id={id}
          value={body}
          maxLength={20_000}
          placeholder={placeholder}
          disabled={disabled || submitting}
          onChange={(event) => {
            setBody(event.target.value);
            if (error) setError(null);
          }}
          className="min-h-16 text-sm"
        />
      </div>
      <AttachmentField
        messages={messages}
        files={files}
        onChange={setFiles}
        disabled={disabled || submitting}
      />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={submitting}
            onClick={onCancel}
          >
            {messages.project.cancel}
          </Button>
        )}
        <Button type="submit" size="sm" disabled={disabled || submitting} className="gap-1.5">
          <Send className="size-3.5" />
          {submitting ? messages.project.sendingComment : submitLabel}
        </Button>
      </div>
      {disabled && (
        <p className="text-[11px] text-muted-foreground">
          {messages.project.discussionClosedNotice}
        </p>
      )}
    </form>
  );
}
