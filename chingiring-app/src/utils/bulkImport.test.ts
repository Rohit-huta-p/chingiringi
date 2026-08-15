// Runnable check for the bulk-import parser. No framework — run with:
//   node --experimental-strip-types src/utils/bulkImport.test.ts
import { parseTable, draftValid, draftToPayload, EMPTY_DRAFT } from './bulkImport.ts';

let n = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { console.error('FAIL:', m); process.exit(1); } };

// 1) TSV with aliased headers + messy numeric cells.
const tsv = [
  'title\tprice\tmrp\tcategory\tbrand\timage\treviews\trating',
  'Wireless Earbuds\t₹1,299\t2999\tElectronics\tAmazon\thttps://x/a.jpg\t1,512\t4.3',
  'Yoga Mat\t499\t\tFitness\tFlipkart\thttps://x/b.jpg\t88\t4.8',
].join('\n');
let { drafts, error } = parseTable(tsv);
ok(!error, 'tsv no error: ' + error);
ok(drafts.length === 2, 'tsv 2 rows: ' + drafts.length);
ok(drafts[0].name === 'Wireless Earbuds', 'name alias title');
ok(drafts[0].price === '1299', 'price stripped ₹ and comma: ' + drafts[0].price);
ok(drafts[0].mrp === '2999', 'mrp');
ok(drafts[0].merchant === 'Amazon', 'merchant alias brand');
ok(drafts[0].images.length === 1 && drafts[0].images[0] === 'https://x/a.jpg', 'image col');
ok(drafts[0].ratingCount === '1512', 'ratingCount alias reviews, comma stripped: ' + drafts[0].ratingCount);
ok(drafts[0].rating === '4.3', 'rating');
ok(drafts[1].mrp === '', 'empty mrp cell stays empty');

// 2) CSV with a quoted field containing a comma, and multi-image "|" split.
const csv = [
  'name,price,description,imageUrl',
  '"Kettle, 1.5L",899,"Fast, quiet boil",https://x/1.jpg|https://x/2.jpg',
].join('\n');
({ drafts, error } = parseTable(csv));
ok(!error, 'csv no error');
ok(drafts[0].name === 'Kettle, 1.5L', 'quoted comma in name: ' + drafts[0].name);
ok(drafts[0].description === 'Fast, quiet boil', 'quoted comma in desc: ' + drafts[0].description);
ok(drafts[0].images.length === 2, 'pipe-split images: ' + drafts[0].images.length);

// 3) Missing name column → error, no drafts.
({ drafts, error } = parseTable('price,category\n999,Home'));
ok(!!error && drafts.length === 0, 'missing name column errors');

// 4) Header only (no data rows) → error.
({ error } = parseTable('name,price'));
ok(!!error, 'header-only errors');

// 5) Validation: name+price required; price ≥ 0; non-numeric price invalid.
ok(draftValid({ ...EMPTY_DRAFT, name: 'A', price: '10' }), 'valid row');
ok(!draftValid({ ...EMPTY_DRAFT, name: '', price: '10' }), 'no name invalid');
ok(!draftValid({ ...EMPTY_DRAFT, name: 'A', price: '' }), 'no price invalid');
ok(draftValid({ ...EMPTY_DRAFT, name: 'A', price: '0' }), 'price 0 is valid');
ok(!draftValid({ ...EMPTY_DRAFT, name: 'A', price: 'abc' }), 'non-numeric price invalid');

// 6) Payload coercion: strings → numbers, mrp ≤ 0 zeroed, images passthrough.
const pay = draftToPayload({ ...EMPTY_DRAFT, name: ' Pan ', price: '499', mrp: '0', rating: '4.5', ratingCount: '30', images: ['u'] });
ok(pay.name === 'Pan' && pay.price === 499 && pay.mrp === 0 && pay.rating === 4.5 && pay.ratingCount === 30 && pay.images[0] === 'u', 'payload coercion');

console.log(`ALL PASS (${n} assertions)`);
