// Pure parsing/validation for the bulk product importer. Kept free of React /
// React-Native imports so it can be unit-tested in plain Node and reused by the
// BulkImportModal. See bulkImport.test.ts for the fixtures.

export const MAX_ROWS = 500;

// Draft = the in-progress row shape (all strings, like the single form). Turned
// into the API payload by draftToPayload once the admin confirms the preview.
export interface Draft {
  name: string;
  price: string;
  mrp: string;
  category: string;
  merchant: string;
  affiliateUrl: string;
  images: string[];
  mobileImages: string[];
  rating: string;
  ratingCount: string;
  description: string;
}

export const EMPTY_DRAFT: Draft = {
  name: '', price: '', mrp: '', category: '', merchant: '', affiliateUrl: '',
  images: [], mobileImages: [], rating: '', ratingCount: '', description: '',
};

// A row is importable only with a name and a non-empty numeric price ≥ 0 — the
// two fields the backend requires.
export function draftValid(d: Draft): boolean {
  const p = Number(d.price);
  return !!d.name.trim() && d.price.trim() !== '' && Number.isFinite(p) && p >= 0;
}

export function draftToPayload(d: Draft) {
  return {
    name: d.name.trim(),
    price: Number(d.price) || 0,
    mrp: Number(d.mrp) > 0 ? Number(d.mrp) : 0,
    category: d.category.trim(),
    merchant: d.merchant.trim(),
    affiliateUrl: d.affiliateUrl.trim(),
    images: d.images,
    mobileImages: d.mobileImages,
    rating: Number(d.rating) || 0,
    ratingCount: Number(d.ratingCount) || 0,
    description: d.description.trim(),
  };
}

// ─── CSV / TSV parsing ────────────────────────────────────────────────────────
// Auto-detects tab vs comma from the header row. Tabs (paste from Sheets/Excel)
// need no quoting; comma mode supports simple "double""quoted" fields.
function splitLine(line: string, delim: string): string[] {
  if (delim === '\t') return line.split('\t');
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// Header aliases → canonical draft field. First non-empty match wins.
const FIELD_ALIASES: Record<keyof Draft, string[]> = {
  name: ['name', 'title', 'productname', 'product'],
  price: ['price', 'sellingprice', 'offerprice', 'saleprice'],
  mrp: ['mrp', 'listprice', 'maxprice', 'originalprice'],
  category: ['category', 'cat'],
  merchant: ['merchant', 'brand', 'store', 'seller', 'source'],
  affiliateUrl: ['affiliateurl', 'url', 'link', 'buyurl', 'producturl', 'buylink'],
  images: ['imageurl', 'image', 'photo', 'img', 'images'],
  mobileImages: ['mobileimageurl', 'mobileimage', 'mobilephoto', 'mobileimages'],
  rating: ['rating', 'stars', 'star'],
  ratingCount: ['ratingcount', 'reviews', 'reviewcount', 'numreviews', 'nreviews'],
  description: ['description', 'desc', 'details'],
};

export function parseTable(text: string): { drafts: Draft[]; error?: string } {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2) return { drafts: [], error: 'Add a header row plus at least one product row.' };
  const delim = lines[0].includes('\t') ? '\t' : ',';
  const headers = splitLine(lines[0], delim).map((h) => h.trim().toLowerCase().replace(/[\s_-]/g, ''));

  const colFor = (field: keyof Draft): number => {
    for (const alias of FIELD_ALIASES[field]) {
      const idx = headers.indexOf(alias);
      if (idx !== -1) return idx;
    }
    return -1;
  };
  const cols = Object.fromEntries(
    (Object.keys(FIELD_ALIASES) as (keyof Draft)[]).map((f) => [f, colFor(f)]),
  ) as Record<keyof Draft, number>;

  if (cols.name === -1) return { drafts: [], error: 'No "name" column found in the header row.' };

  const splitUrls = (s: string) => s.split(/[|,]/).map((u) => u.trim()).filter(Boolean);
  const drafts = lines.slice(1, 1 + MAX_ROWS).map((line) => {
    const cells = splitLine(line, delim);
    const get = (f: keyof Draft) => (cols[f] === -1 ? '' : (cells[cols[f]] ?? '').trim());
    return {
      ...EMPTY_DRAFT,
      name: get('name'),
      price: get('price').replace(/[^0-9.]/g, ''),
      mrp: get('mrp').replace(/[^0-9.]/g, ''),
      category: get('category'),
      merchant: get('merchant'),
      affiliateUrl: get('affiliateUrl'),
      images: splitUrls(get('images')),
      mobileImages: splitUrls(get('mobileImages')),
      rating: get('rating').replace(/[^0-9.]/g, ''),
      ratingCount: get('ratingCount').replace(/[^0-9]/g, ''),
      description: get('description'),
    };
  });
  return { drafts };
}
