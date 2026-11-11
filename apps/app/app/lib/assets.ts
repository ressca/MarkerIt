/**
 * Returns a same-origin URL for an authenticated asset.
 *
 * The browser never receives the API session cookie directly in production,
 * so images are streamed through the app's own route which forwards the
 * session server-side.
 */
export function assetContentUrl(assetId: string): string {
  return `/api/assets/${encodeURIComponent(assetId)}/content`;
}
