import { describe, expect, it } from 'vitest';
import { assetContentUrl } from './assets';

describe('assetContentUrl', () => {
  it('builds a same-origin authenticated content URL', () => {
    expect(assetContentUrl('asset-1')).toBe('/api/assets/asset-1/content');
    expect(assetContentUrl('asset/with space')).toBe('/api/assets/asset%2Fwith%20space/content');
  });
});
