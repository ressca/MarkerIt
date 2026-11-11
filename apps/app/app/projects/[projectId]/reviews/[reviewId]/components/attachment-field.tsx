'use client';

import { useId, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ImageIcon, X } from 'lucide-react';
import { Button, Input, Label } from '@markerit/ui';
import type { TranslationMessages } from '@markerit/i18n';
import { MAX_ATTACHMENT_BYTES, MAX_COMMENT_ATTACHMENTS } from '../../../../../lib/project-constants';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg'];

export interface AttachmentFieldProps {
  messages: TranslationMessages;
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  inputId?: string;
}

/** Validates and collects image attachments before they are uploaded on submit. */
export function AttachmentField({
  messages,
  files,
  onChange,
  disabled = false,
  inputId,
}: AttachmentFieldProps) {
  const generatedId = useId();
  const id = inputId ?? `attachments-${generatedId}`;
  const [error, setError] = useState<string | null>(null);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = [...(event.target.files ?? [])];
    event.target.value = '';
    if (selected.length === 0) return;

    if (files.length + selected.length > MAX_COMMENT_ATTACHMENTS) {
      setError(messages.project.attachmentLimitError);
      return;
    }
    if (selected.some((file) => !ACCEPTED_TYPES.includes(file.type))) {
      setError(messages.project.attachmentUnsupported);
      return;
    }
    if (selected.some((file) => file.size > MAX_ATTACHMENT_BYTES)) {
      setError(messages.project.attachmentTooLarge);
      return;
    }

    setError(null);
    onChange([...files, ...selected]);
  }

  function removeAt(index: number) {
    setError(null);
    onChange(files.filter((_, position) => position !== index));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{messages.project.attachmentsLabel}</Label>
        <span className="text-[11px] text-muted-foreground">
          {files.length} / {MAX_COMMENT_ATTACHMENTS}
        </span>
      </div>
      <Input
        id={id}
        type="file"
        accept="image/png,image/jpeg"
        multiple
        disabled={disabled}
        onChange={handleFiles}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="text-[11px] text-muted-foreground">
        {messages.project.attachmentsHint}
      </p>
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={messages.project.attachmentsSelected}>
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pr-1 pl-2 text-[11px] text-foreground"
            >
              <ImageIcon className="size-3 text-muted-foreground" aria-hidden="true" />
              <span className="max-w-40 truncate">{file.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={disabled}
                aria-label={`${messages.project.removeAttachment}: ${file.name}`}
                onClick={() => removeAt(index)}
                className="size-4 text-muted-foreground"
              >
                <X className="size-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
