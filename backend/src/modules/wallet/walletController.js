import Wallet from './walletModel.js';
import Transaction from '../transactions/transactionModel.js';
import AdminSettings from '../admin/adminSettingsModel.js';
import { notify } from '../notifications/notificationService.js';
import ShareEvent from '../shares/shareModel.js';
import { payoutsEnabled, firePayout } from '../payments/payoutService.js';

// @desc    Get current user's wallet
// @route   GET /api/wallet
// @access  Private
export const getWallet = async (req, res) => {
  let wallet = await Wallet.findOne({ userId: req.user._id }).lean();
  if (!wallet) {
    wallet = await Wallet.create({ userId: req.user._id });
    wallet = wallet.toObject();
  }

  // Derived, display-only — never mutates wallet balances.
  const agg = await ShareEvent.aggregate([
    { $match: { userId: req.user._id } },
    { $group: { _id: '$status', coins: { $sum: '$coinsAwarded' } } },
  ]);
  const byStatus = Object.fromEntries(agg.map((r) => [r._id, r.coins]));
  const shareRewards = { pending: byStatus.pending || 0, confirmed: byStatus.confirmed || 0 };

  res.status(200).json({ status: 'success', data: { wallet, shareRewards } });
};

// @desc    Get wallet summary (balances + recent transactions)
// @route   GET /api/wallet/summary
// @access  Private
export const getWalletSummary = async (req, res) => {
  let wallet = await Wallet.findOne({ userId: req.user._id }).lean();

  if (!wallet) {
    wallet = await Wallet.create({ userId: req.user._id });
    wallet = wallet.toObject();
  }

  const recentTransactions = await Transaction.find({ userId: req.user._id })
    .sort('-createdAt')
    .limit(5)
    .lean();

  res.status(200).json({
    status: 'success',
    data: { wallet, recentTransactions },
  });
};

// @desc    Get transaction history (filtered, paginated)
// @route   GET /api/wallet/transactions
// @access  Private
export const getTransactions = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    type,
    status,
    period,
    sort = '-createdAt',
  } = req.query;

  const filter = { userId: req.user._id };

  if (type) filter.type = type;
  if (status) filter.status = status;

  if (period) {
    const now = new Date();
    switch (period) {
      case '7d':
        filter.createdAt = { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) };
        break;
      case '30d':
        filter.createdAt = { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) };
        break;
      case '90d':
        filter.createdAt = { $gte: new Date(now - 90 * 24 * 60 * 60 * 1000) };
        break;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Transaction.countDocuments(filter),
  ]);

  // Calculate summary stats
  const summary = await Transaction.aggregate([
    { $match: { userId: req.user._id, status: 'confirmed' } },
    {
      $group: {
        _id: null,
        totalEarned: {
          $sum: {
            $cond: [{ $in: ['$type', ['cashback', 'referral', 'bonus']] }, '$amount', 0],
          },
        },
        totalWithdrawn: {
          $sum: {
            $cond: [{ $eq: ['$type', 'withdrawal'] }, { $abs: '$amount' }, 0],
          },
        },
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      transactions,
      summary: summary[0] || { totalEarned: 0, totalWithdrawn: 0 },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
};

// @desc    Request a withdrawal
// @route   POST /api/wallet/withdraw
// @access  Private
//
// User submits an amount in COINS and a payment destination. Server:
//   1. Loads the current coinsPerRupee to compute the ₹ payout.
//   2. Checks the user has enough CONFIRMED coins (wallet.coins, not pending).
//   3. Creates a pending Transaction(type='withdrawal') with the ₹ + coin
//      count + locked rate stamped on metadata for later audit.
//   4. Does NOT debit the wallet — that happens on admin approval.
//
// The rate is locked at request time so a settings change between request
// and approval doesn't retroactively change what the user is owed.
export const requestWithdrawal = async (req, res) => {
  const { coins, method, paymentDetails, accountNumber, ifsc } = req.body;

  const coinAmount = Number(coins);
  if (!Number.isFinite(coinAmount) || coinAmount <= 0) {
    res.status(400);
    throw new Error('coins must be a positive number');
  }
  if (!['UPI', 'Bank'].includes(method)) {
    res.status(400);
    throw new Error('method must be UPI or Bank');
  }
  if (!paymentDetails || typeof paymentDetails !== 'string' || !paymentDetails.trim()) {
    res.status(400);
    throw new Error('paymentDetails is required');
  }
  if (method === 'Bank' && (!accountNumber || !ifsc)) {
    res.status(400);
    throw new Error('accountNumber and ifsc are required for Bank withdrawals');
  }

  const wallet = await Wallet.findOne({ userId: req.user._id });
  if (!wallet || wallet.coins < coinAmount) {
    res.status(400);
    throw new Error(`Insufficient confirmed coins (${wallet?.coins ?? 0} available, ${coinAmount} requested)`);
  }

  const settings = await AdminSettings.get();
  const coinRate = settings.coinsPerRupee;   // coins per ₹1
  const rupees = Math.round((coinAmount / coinRate) * 100) / 100;

  const transaction = await Transaction.create({
    userId: req.user._id,
    type: 'withdrawal',
    amount: rupees,
    status: 'pending',
    description: `Withdrawal request — ${coinAmount} coins (₹${rupees})`,
    metadata: {
      method,
      paymentDetails: paymentDetails.trim(),
      ...(accountNumber ? { accountNumber } : {}),
      ...(ifsc          ? { ifsc }          : {}),
      coinsRedeemed: coinAmount,
      coinRate,                 // locked at request time
      requestedAt: new Date(),
    },
  });

  // ── Instant-on-tap payout — DISABLED ─────────────────────────────────────
  // Withdrawals no longer auto-pay via the provider (Cashfree). Every request
  // stays `pending` and is actioned by an admin in Wallet Operations →
  // Withdrawals. To re-enable, uncomment the block below (it stays gated by
  // AdminSettings.instantPayoutEnabled + the payout provider's creds).
  let instant = false;
  // if (settings.instantPayoutEnabled && (await payoutsEnabled())) {
  //   const cap = Number(settings.instantPayoutCapRupees) || 0;
  //   const since = new Date();
  //   since.setHours(0, 0, 0, 0);
  //   const agg = await Transaction.aggregate([
  //     { $match: { userId: req.user._id, type: 'withdrawal', 'metadata.paidInstant': true, createdAt: { $gte: since } } },
  //     { $group: { _id: null, total: { $sum: '$amount' } } },
  //   ]);
  //   const todayInstant = agg[0]?.total || 0;
  //   if (cap > 0 && todayInstant + rupees <= cap) {
  //     try {
  //       await firePayout(transaction, {}); // atomic coin hold + provider transfer
  //       transaction.metadata = { ...transaction.metadata, paidInstant: true };
  //       await transaction.save();
  //       instant = true;
  //     } catch (e) {
  //       instant = false;
  //     }
  //   }
  // }

  try {
    await notify({ userId: req.user._id, type: 'withdrawal_submitted', data: { amount: rupees } });
  } catch (e) { /* best-effort */ }

  res.status(201).json({
    status: 'success',
    data: {
      transaction,
      instant,                    // paid instantly vs queued for admin approval
      status: transaction.status, // 'processing' (instant) | 'pending' (admin)
      preview: {
        coinsRedeemed: coinAmount,
        rupees,
        coinRate,
      },
    },
  });
};

// @desc    Get single transaction detail
// @route   GET /api/wallet/transactions/:id
// @access  Private
export const getTransaction = async (req, res) => {
  const transaction = await Transaction.findOne({
    _id: req.params.id,
    userId: req.user._id,
  }).lean();

  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found');
  }

  res.status(200).json({ status: 'success', data: { transaction } });
};
