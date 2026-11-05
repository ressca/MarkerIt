import { describe, expect, it } from 'vitest';
import { metadata } from './layout';
import sitemap from './sitemap';
import robots from './robots';

describe('landing metadata and crawler routes', () => {
  it('exposes localized SEO and social metadata', () => {
    expect(metadata.metadataBase?.toString()).toBe('http://localhost:3001/');
    expect(metadata.title).toMatchObject({ default: expect.stringContaining('markerIt') });
    expect(metadata.openGraph).toMatchObject({ type: 'website', locale: 'pl_PL', siteName: 'markerIt' });
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });

  it('lists the homepage in sitemap and allows public crawler access', () => {
    expect(sitemap()).toEqual([{ url: 'http://localhost:3001', changeFrequency: 'monthly', priority: 1 }]);
    expect(robots()).toMatchObject({ rules: { userAgent: '*', allow: '/' }, sitemap: 'http://localhost:3001/sitemap.xml' });
  });
});
