import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { getMessages } from '@markerit/i18n';
import type { DiscussionPinDto } from '@markerit/api-client';
import {
  clampPercent,
  percentFromPoint,
  ReviewCanvas,
} from './review-canvas';

const messages = getMessages('pl');

const pins: DiscussionPinDto[] = [
  {
    id: 'pin-1',
    assetId: 'asset-1',
    xPercent: 20,
    yPercent: 30,
    status: 'OPEN',
    authorId: 'user-1',
    authorName: 'Anna',
    authorInitials: 'AK',
    createdAt: '2026-11-10T10:00:00Z',
    resolvedBy: null,
    resolvedByName: null,
    resolvedAt: null,
    commentCount: 1,
  },
  {
    id: 'pin-2',
    assetId: 'asset-1',
    xPercent: 75.5,
    yPercent: 60,
    status: 'RESOLVED',
    authorId: 'user-2',
    authorName: 'Jan',
    authorInitials: 'JN',
    createdAt: '2026-11-10T11:00:00Z',
    resolvedBy: 'user-2',
    resolvedByName: 'Jan',
    resolvedAt: '2026-11-10T12:00:00Z',
    commentCount: 0,
  },
];

function renderCanvas(overrides: Partial<Parameters<typeof ReviewCanvas>[0]> = {}) {
  const handlers = {
    onAddPin: vi.fn(),
    onHoverPin: vi.fn(),
    onSelectPin: vi.fn(),
  };
  render(
    <ReviewCanvas
      messages={messages}
      imageUrl="/api/assets/asset-1/content"
      imageAlt="Baner — Wersja 2"
      pins={pins}
      highlightedPinId={null}
      isClosed={false}
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

describe('percent helpers', () => {
  it('converts pointer coordinates to clamped percentages', () => {
    expect(percentFromPoint(50, 25, { left: 0, top: 0, width: 200, height: 100 })).toEqual({
      xPercent: 25,
      yPercent: 25,
    });
    expect(percentFromPoint(500, -20, { left: 0, top: 0, width: 200, height: 100 })).toEqual({
      xPercent: 100,
      yPercent: 0,
    });
    expect(clampPercent(Number.NaN)).toBe(0);
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(140)).toBe(100);
  });
});

describe('ReviewCanvas', () => {
  it('renders pins at their percentage positions and marks resolved pins', () => {
    renderCanvas();

    expect(screen.getByRole('img', { name: 'Baner — Wersja 2' })).toHaveAttribute(
      'src',
      '/api/assets/asset-1/content',
    );
    const open = screen.getByTestId('pin-marker-pin-1');
    const resolved = screen.getByTestId('pin-marker-pin-2');
    expect(open).toHaveStyle({ left: '20%', top: '30%' });
    expect(open).toHaveTextContent('1');
    expect(open).toHaveAttribute('data-resolved', 'false');
    expect(resolved).toHaveStyle({ left: '75.5%', top: '60%' });
    expect(resolved).toHaveAttribute('data-resolved', 'true');
    expect(resolved).toHaveTextContent('2');
  });

  it('opens the add-pin flow with image-relative coordinates', () => {
    const { onAddPin, onSelectPin } = renderCanvas();
    const canvas = screen.getByTestId('review-canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 20,
      width: 200,
      height: 100,
      right: 210,
      bottom: 120,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.click(canvas, { clientX: 60, clientY: 45 });

    expect(onAddPin).toHaveBeenCalledWith({ xPercent: 25, yPercent: 25 });
    expect(onSelectPin).not.toHaveBeenCalled();
  });

  it('highlights pins on hover and selects them without creating a new pin', async () => {
    const user = userEvent.setup();
    const { onAddPin, onHoverPin, onSelectPin } = renderCanvas();

    await user.hover(screen.getByTestId('pin-marker-pin-1'));
    expect(onHoverPin).toHaveBeenCalledWith('pin-1');

    await user.click(screen.getByTestId('pin-marker-pin-1'));
    expect(onSelectPin).toHaveBeenCalledWith('pin-1');
    expect(onAddPin).not.toHaveBeenCalled();
  });

  it('opens the add-pin flow from the keyboard at the image centre', async () => {
    const user = userEvent.setup();
    const { onAddPin } = renderCanvas();
    const canvas = screen.getByTestId('review-canvas');

    expect(canvas).toHaveAttribute('role', 'button');
    expect(canvas).toHaveAttribute('tabindex', '0');
    expect(canvas).toHaveAttribute('aria-describedby', 'review-canvas-hint');

    canvas.focus();
    expect(canvas).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onAddPin).toHaveBeenCalledWith({ xPercent: 50, yPercent: 50 });

    onAddPin.mockClear();
    await user.keyboard(' ');
    expect(onAddPin).toHaveBeenCalledWith({ xPercent: 50, yPercent: 50 });
  });

  it('keeps markers inside the padded canvas frame', () => {
    renderCanvas();
    expect(screen.getByTestId('review-canvas-frame').className).toContain('p-4');
  });

  it('does not allow adding pins when the review is closed', async () => {
    const user = userEvent.setup();
    const { onAddPin } = renderCanvas({ isClosed: true });
    const canvas = screen.getByTestId('review-canvas');
    expect(canvas).toHaveAttribute('aria-label', messages.project.canvasClosedLabel);
    expect(canvas).not.toHaveAttribute('role', 'button');
    expect(canvas).toHaveAttribute('tabindex', '-1');

    await user.click(canvas);
    await user.keyboard('{Enter}');
    expect(onAddPin).not.toHaveBeenCalled();
  });

  it('shows an empty state when the version has no image', () => {
    renderCanvas({ imageUrl: null });
    expect(screen.queryByTestId('review-canvas')).not.toBeInTheDocument();
    expect(screen.getByText(messages.project.emptyPhotosDescription)).toBeInTheDocument();
  });
});
