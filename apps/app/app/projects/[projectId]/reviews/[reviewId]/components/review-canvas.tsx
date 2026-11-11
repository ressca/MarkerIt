'use client';

import { ImageIcon, MapPin } from 'lucide-react';
import type { DiscussionPinDto } from '@markerit/api-client';
import type { TranslationMessages } from '@markerit/i18n';
import { cn } from 'cn';
import type { PinPoint } from './add-pin-dialog';

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export interface ClientRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Converts a pointer position to percentages relative to the image box. */
export function percentFromPoint(
  clientX: number,
  clientY: number,
  rect: ClientRectLike,
): PinPoint {
  return {
    xPercent: clampPercent(((clientX - rect.left) / rect.width) * 100),
    yPercent: clampPercent(((clientY - rect.top) / rect.height) * 100),
  };
}

export interface ReviewCanvasProps {
  messages: TranslationMessages;
  imageUrl?: string | null;
  imageAlt: string;
  pins: DiscussionPinDto[];
  highlightedPinId: string | null;
  isClosed: boolean;
  onAddPin: (point: PinPoint) => void;
  onHoverPin: (pinId: string | null) => void;
  onSelectPin: (pinId: string) => void;
}

/**
 * The review image with absolutely positioned pin markers. Clicking the image
 * opens the add-pin flow at the clicked coordinates; markers stay interactive
 * and do not trigger a new pin.
 */
export function ReviewCanvas({
  messages,
  imageUrl,
  imageAlt,
  pins,
  highlightedPinId,
  isClosed,
  onAddPin,
  onHoverPin,
  onSelectPin,
}: ReviewCanvasProps) {
  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (isClosed) return;
    if ((event.target as HTMLElement).closest('button')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    onAddPin(percentFromPoint(event.clientX, event.clientY, rect));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (isClosed || event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    // Keyboard users cannot point at a coordinate, so place the pin in the
    // middle of the image and let them add the note in the dialog.
    onAddPin({ xPercent: 50, yPercent: 50 });
  }

  if (!imageUrl) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center gap-2 bg-muted/50 p-10 text-muted-foreground">
        <ImageIcon className="size-10" />
        <span className="text-xs">{messages.project.emptyPhotosDescription}</span>
      </div>
    );
  }

  const hintId = 'review-canvas-hint';
  return (
    <div
      className="relative flex min-h-56 items-center justify-center overflow-hidden bg-muted/50 p-4"
      data-testid="review-canvas-frame"
    >
      <span id={hintId} className="sr-only">
        {isClosed ? messages.project.canvasClosedLabel : messages.project.canvasAddPinHint}
      </span>
      <div
        className={cn(
          'relative inline-block max-w-full',
          !isClosed && 'cursor-crosshair',
        )}
        data-testid="review-canvas"
        role={isClosed ? undefined : 'button'}
        tabIndex={isClosed ? -1 : 0}
        aria-label={
          isClosed ? messages.project.canvasClosedLabel : messages.project.canvasAddPinHint
        }
        aria-describedby={hintId}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <img
          src={imageUrl}
          alt={imageAlt}
          data-testid="review-canvas-image"
          className="block max-h-[70dvh] max-w-full object-contain"
          draggable={false}
        />
        {pins.map((pin, index) => {
          const resolved = pin.status === 'RESOLVED';
          const active = highlightedPinId === pin.id;
          return (
            <button
              key={pin.id}
              id={`pin-marker-${pin.id}`}
              type="button"
              data-testid={`pin-marker-${pin.id}`}
              data-x-percent={pin.xPercent}
              data-y-percent={pin.yPercent}
              data-resolved={resolved ? 'true' : 'false'}
              aria-label={messages.project.pinMarkerLabel
                .replace('{index}', String(index + 1))
                .replace('{status}', resolved ? messages.project.pinStatusResolved : messages.project.pinStatusOpen)}
              aria-pressed={active}
              onClick={(event) => {
                event.stopPropagation();
                onSelectPin(pin.id);
              }}
              onMouseEnter={() => onHoverPin(pin.id)}
              onMouseLeave={() => onHoverPin(null)}
              onFocus={() => onHoverPin(pin.id)}
              onBlur={() => onHoverPin(null)}
              style={{ left: `${pin.xPercent}%`, top: `${pin.yPercent}%` }}
              className={cn(
                'absolute z-10 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold shadow-md outline-none transition-transform focus-visible:ring-3 focus-visible:ring-ring/60',
                resolved
                  ? 'bg-muted text-muted-foreground opacity-80'
                  : 'bg-primary text-primary-foreground',
                active && 'z-20 scale-125 ring-3 ring-primary/40',
              )}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
      {pins.length === 0 && !isClosed && (
        <span className="pointer-events-none absolute flex items-center gap-1.5 rounded-full bg-background/85 px-3 py-1 text-[11px] text-muted-foreground shadow-xs">
          <MapPin className="size-3" />
          {messages.project.canvasAddPinHint}
        </span>
      )}
    </div>
  );
}
