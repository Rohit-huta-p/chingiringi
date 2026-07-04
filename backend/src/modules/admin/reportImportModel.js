import mongoose from 'mongoose';

/**
 * Audit trail for every merchant report ingestion.
 *
 * The Reports Inbox in the Wallet Operations hub takes a pasted CSV / file
 * from the admin, parses rows, matches them to users (via subid or click log),
 * and bulk-creates pending Transactions. This model records what happened so
 * months later the admin can answer "what report credited Rahul ₹75 on Mar 5
 * and where can I see the original row?".
 *
 * rows is stored as a snapshot of the input — gives us replay-ability if a
 * future matcher gets smarter and we want to re-run old reports.
 */
const rowResultSchema = new mongoose.Schema(
  {
    rawRow:       { type: mongoose.Schema.Types.Mixed }, // original CSV row as JSON
    orderId:      String,
    subid:        String,
    amount:       Number,
    commission:   Number,
    status:       String,                                // merchant's status, e.g. 'confirmed'
    matchedUserId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    matchedVia:      { type: String, enum: ['subid', 'click_log', 'manual', 'none'] },
    matchConfidence: Number,                             // 0-100; 100 = subid exact
    transactionId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
    error:           String,                             // if row failed to import
  },
  { _id: false },
);

const reportImportSchema = new mongoose.Schema(
  {
    merchant:    { type: String, required: true, lowercase: true, trim: true, index: true },
    periodStart: { type: Date },
    periodEnd:   { type: Date },

    importedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    importedAt:   { type: Date, default: Date.now },

    totalRows:                Number,
    matchedRows:              Number,
    unmatchedRows:            Number,
    failedRows:               Number,
    totalCommissionCredited:  { type: Number, default: 0 },

    rows: [rowResultSchema], // per-row match outcome — auditable forever
  },
  { timestamps: true },
);

reportImportSchema.index({ importedAt: -1 });
reportImportSchema.index({ merchant: 1, importedAt: -1 });

const ReportImport = mongoose.model('ReportImport', reportImportSchema);

export default ReportImport;
