import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['cashback', 'referral', 'withdrawal', 'bonus', 'coin_credit', 'coin_debit'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'rejected', 'processing', 'completed'],
      default: 'pending',
    },
    description: {
      type: String,
      required: true,
    },
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deal',
    },
    // Loose bag of type-specific fields — affiliate brand/orderId, lock timing,
    // and withdrawal payout details (method, paymentDetails, accountNumber,
    // ifsc, coinsRedeemed, coinRate, payoutId, payoutStatus, contactId,
    // fundAccountId, …). Mixed so arbitrary keys persist: a typed sub-schema
    // silently dropped the payout fields on save under Mongoose strict mode.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ userId: 1, type: 1 });
transactionSchema.index({ userId: 1, status: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
