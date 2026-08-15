import { describe, it, expect } from '@jest/globals';
import { buildMerchantSearchUrl } from '../modules/clicks/subidBuilder.js';

describe('buildMerchantSearchUrl', () => {
  it('returns amazon search URL with encoded query', () => {
    const url = buildMerchantSearchUrl('amazon', 'bluetooth headphones');
    expect(url).toBe('https://www.amazon.in/s?k=bluetooth%20headphones');
  });

  it('returns flipkart search URL', () => {
    const url = buildMerchantSearchUrl('flipkart', 'running shoes');
    expect(url).toBe('https://www.flipkart.com/search?q=running%20shoes');
  });

  it('returns myntra URL with slug path and rawQuery param', () => {
    const url = buildMerchantSearchUrl('myntra', 'casual shirts');
    expect(url).toContain('https://www.myntra.com/casual-shirts');
    expect(url).toContain('rawQuery=casual%20shirts');
  });

  it('myntra slug strips non-alphanumeric chars', () => {
    const url = buildMerchantSearchUrl('myntra', "men's t-shirts!");
    // slug: "mens tshirts" → "mens-tshirts"
    expect(url).toContain('/mens-tshirts');
  });

  it('returns meesho search URL', () => {
    const url = buildMerchantSearchUrl('meesho', 'kurti');
    expect(url).toBe('https://www.meesho.com/search?q=kurti');
  });

  it('returns null for unknown merchant', () => {
    const url = buildMerchantSearchUrl('unknown_store', 'shoe');
    expect(url).toBeNull();
  });

  it('trims whitespace from searchQuery', () => {
    const url = buildMerchantSearchUrl('amazon', '  shoes  ');
    expect(url).toBe('https://www.amazon.in/s?k=shoes');
  });
});
