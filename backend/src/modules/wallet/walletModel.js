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
