import { describe, it, expect } from '@jest/globals';
import { buildSearchPipeline } from '../modules/products/searchPipeline.js';

describe('buildSearchPipeline', () => {
  it('has $search as first stage when search is present', () => {
    const p = buildSearchPipeline({ search: 'shoe', page: 1, limit: 12 });
    expect(Object.keys(p[0])[0]).toBe('$search');
  });

  it('has NO $search stage when search is absent', () => {
    const p = buildSearchPipeline({ page: 1, limit: 12 });
    expect(p.some(s => s.$search)).toBe(false);
  });

  it('has isActive:true in $match (not in Atlas filter) when search is absent', () => {
    const p = buildSearchPipeline({ page: 1, limit: 12 });
    expect(p[0].$match?.isActive).toBe(true);
  });

  it('puts $match AFTER $search when both are present', () => {
    const p = buildSearchPipeline({ search: 'shoe', category: 'Footwear', page: 1, limit: 12 });
    const keys = p.map(s => Object.keys(s)[0]);
    expect(keys.indexOf('$search')).toBe(0);
    expect(keys.indexOf('$match')).toBeGreaterThan(0);
  });

  it('includes category filter in $match', () => {
    const p = buildSearchPipeline({ search: 'shoe', category: 'Footwear', page: 1, limit: 12 });
    const m = p.find(s => s.$match?.category);
    expect(m.$match.category).toEqual({ $regex: '^Footwear$', $options: 'i' });
  });

  it('includes price range in $match', () => {
    const p = buildSearchPipeline({ minPrice: 100, maxPrice: 500, page: 1, limit: 12 });
    const m = p.find(s => s.$match?.price);
    expect(m.$match.price).toEqual({ $gte: 100, $lte: 500 });
  });

  it('includes minCoins filter in $match', () => {
    const p = buildSearchPipeline({ minCoins: 500, page: 1, limit: 12 });
    const m = p.find(s => s.$match?.coinsPrice);
    expect(m.$match.coinsPrice.$gte).toBe(500);
  });

  it('includes minRating filter in $match', () => {
    const p = buildSearchPipeline({ minRating: 4, page: 1, limit: 12 });
    const m = p.find(s => s.$match?.rating);
    expect(m.$match.rating).toEqual({ $gte: 4 });
  });

  it('has minDiscount $match AFTER $addFields', () => {
    const p = buildSearchPipeline({ minDiscount: 20, page: 1, limit: 12 });
    const keys = p.map(s => Object.keys(s)[0]);
    const af = keys.indexOf('$addFields');
    // second $match (discount) comes after $addFields
    const discountMatch = p.findIndex((s, i) => i > af && s.$match?._discount);
    expect(discountMatch).toBeGreaterThan(af);
  });

  it('omits $sort when search is present and sort is null/undefined', () => {
    const p = buildSearchPipeline({ search: 'shoe', sort: null, page: 1, limit: 12 });
    expect(p.some(s => s.$sort)).toBe(false);
  });

  it('includes $sort with price:1 when sort=price_asc', () => {
    const p = buildSearchPipeline({ search: 'shoe', sort: 'price_asc', page: 1, limit: 12 });
    const s = p.find(st => st.$sort);
    expect(s.$sort.price).toBe(1);
  });

  it('includes $sort newest by default when no search', () => {
    const p = buildSearchPipeline({ page: 1, limit: 12 });
    const s = p.find(st => st.$sort);
    expect(s.$sort.createdAt).toBe(-1);
  });

  it('Atlas compound has autocomplete with boost 5 and fuzzy maxEdits 1 on name', () => {
    const p = buildSearchPipeline({ search: 'shoe', page: 1, limit: 12 });
    const { compound } = p[0].$search;
    const ac = compound.should.find(c => c.autocomplete?.path === 'name');
    expect(ac.autocomplete.fuzzy.maxEdits).toBe(1);
    expect(ac.autocomplete.score.boost.value).toBe(5);
  });

  it('Atlas compound has text on name with boost 3 and fuzzy maxEdits 2', () => {
    const p = buildSearchPipeline({ search: 'shoe', page: 1, limit: 12 });
    const { compound } = p[0].$search;
    const txt = compound.should.find(c => c.text?.path === 'name');
    expect(txt.text.fuzzy.maxEdits).toBe(2);
    expect(txt.text.score.boost.value).toBe(3);
  });

  it('Atlas compound filter has isActive:true equals clause', () => {
    const p = buildSearchPipeline({ search: 'shoe', page: 1, limit: 12 });
    const { compound } = p[0].$search;
    const activeFilter = compound.filter.find(f => f.equals?.path === 'isActive');
    expect(activeFilter.equals.value).toBe(true);
  });

  it('last stage is $facet with products and total', () => {
    const p = buildSearchPipeline({ page: 1, limit: 12 });
    const last = p[p.length - 1];
    expect(last.$facet).toHaveProperty('products');
    expect(last.$facet).toHaveProperty('total');
  });

  it('$facet products has correct $skip for page 3, limit 24', () => {
    const p = buildSearchPipeline({ page: 3, limit: 24 });
    const facet = p[p.length - 1].$facet;
    const skip = facet.products.find(s => s.$skip !== undefined);
    expect(skip.$skip).toBe(48); // (3-1)*24
  });

  it('$facet products has $limit matching the limit param', () => {
    const p = buildSearchPipeline({ page: 1, limit: 6 });
    const facet = p[p.length - 1].$facet;
    const lim = facet.products.find(s => s.$limit !== undefined);
    expect(lim.$limit).toBe(6);
  });

  it('index name is "products"', () => {
    const p = buildSearchPipeline({ search: 'x', page: 1, limit: 12 });
    expect(p[0].$search.index).toBe('products');
  });
});
