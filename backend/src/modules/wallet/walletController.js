import Wallet from './walletModel.js';
import Transaction from '../transactions/transactionModel.js';

// @desc    Get current user's wallet
// @route   GET /api/wallet
// @access  Private
export const getWallet = async (req, res) => {
  let wallet = await Wallet.findOne({ userId: req.user._id }).lean();

  if (!wallet) {
    wallet = await Wallet.create({ userId: req.user._id });
    wallet = wallet.toObject();
  }

  res.status(200).json({ status: 'success', data: { wallet } });
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
