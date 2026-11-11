'use client';

import { useEffect, useState } from 'react';
import type {
  AssetDto,
  CreateReviewInput,
  WorkspaceMemberDto,
} from '@markerit/api-client';
import type { TranslationMessages } from '@markerit/i18n';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@markerit/ui';
import { Check } from 'lucide-react';
import { assetContentUrl } from '../../../lib/assets';
import { ReviewerPicker } from './reviewer-picker';
import { cn } from 'cn';

interface CreateReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: AssetDto[];
  members: WorkspaceMemberDto[];
  currentUserId: string;
  messages: TranslationMessages;
  onCreate: (input: CreateReviewInput) => Promise<string | null>;
}

export function CreateReviewDialog({
  open,
  onOpenChange,
  assets,
  members,
  currentUserId,
  messages,
  onCreate,
}: CreateReviewDialogProps) {
  const [assetId, setAssetId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reviewerIds, setReviewerIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setAssetId('');
      setTitle('');
      setDescription('');
      setReviewerIds([]);
      setError('');
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(messages.project.titleRequired);
      return;
    }
    if (trimmedTitle.length > 120) {
      setError(messages.project.titleTooLong);
      return;
    }
    if (!assetId) {
      setError(messages.project.imageRequired);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const creationError = await onCreate({
        title: trimmedTitle,
        description: description.trim() || undefined,
        assetId,
        reviewerIds,
      });
      if (creationError) {
        setError(creationError);
        return;
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{messages.project.createThreadTitle}</DialogTitle>
            <DialogDescription>{messages.project.createThreadDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label>{messages.project.imageLabel} *</Label>
              {assets.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                  {messages.project.emptyPhotosDescription}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {assets.map((asset) => {
                    const selected = asset.id === assetId;
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        aria-label={asset.originalName}
                        aria-pressed={selected}
                        onClick={() => {
                          setAssetId(asset.id);
                          if (error) setError('');
                        }}
                        className={cn(
                          'group relative aspect-square overflow-hidden rounded-lg border bg-muted outline-none transition-all focus-visible:ring-3 focus-visible:ring-ring/50',
                          selected
                            ? 'border-primary ring-2 ring-primary/40'
                            : 'border-border hover:border-primary/40',
                        )}
                      >
                        <img
                          src={assetContentUrl(asset.id)}
                          alt={asset.originalName}
                          className="size-full object-cover"
                          loading="lazy"
                        />
                        {selected && (
                          <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                            <Check className="size-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="review-title">{messages.project.titleLabel} *</Label>
              <Input
                id="review-title"
                value={title}
                maxLength={120}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (error) setError('');
                }}
                placeholder={messages.project.titlePlaceholder}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="review-description">{messages.project.descriptionLabel}</Label>
              <Textarea
                id="review-description"
                value={description}
                maxLength={4000}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={messages.project.descriptionPlaceholder}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{messages.project.reviewersLabel}</Label>
              <p className="text-[11px] text-muted-foreground">
                {messages.project.reviewersHint}
              </p>
              <ReviewerPicker
                members={members}
                currentUserId={currentUserId}
                selectedIds={reviewerIds}
                onChange={setReviewerIds}
                messages={messages}
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {messages.project.cancel}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || assets.length === 0}
              className="gap-1.5"
            >
              {submitting ? messages.project.creatingThread : messages.project.createThreadAction}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
