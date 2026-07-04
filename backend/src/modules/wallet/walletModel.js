import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    pendingCashback: {
      type: Number,
      default: 0,
      min: 0,
    },
    confirmedCashback: {
      type: Number,
      default: 0,
      min: 0,
    },
    coins: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Coins credited from a merchant report but still inside the merchant's
    // return window (lock period). Users can SEE these in their app but
    // can't WITHDRAW against them — only `coins` (confirmed) is spendable.
    // Split lets us reverse a canceled/returned order without touching the
    // user's confirmed balance.
    pendingCoins: {
      type: Number,
      default: 0,
      min: 0,
    },
    lifetimeEarned: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Wallet = mongoose.model('Wallet', walletSchema);

export default Wallet;
