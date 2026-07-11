import User from '../users/userModel.js';
import Deal from '../deals/dealModel.js';
import Wallet from '../wallet/walletModel.js';
import Transaction from '../transactions/transactionModel.js';
import ClickEvent from '../clicks/clickModel.js';

// Every number here is aggregated live from the DB — no seed/mock fallbacks.
// A fresh install reads as all-zeros, which is correct, not broken.
export const getDashboardStats = async (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalUsers, activeUsers, totalDeals, totalClicks, conversions, wallets] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ lastLoginAt: { $gte: thirtyDaysAgo } }),
      Deal.countDocuments(),
      ClickEvent.countDocuments(),
      Transaction.countDocuments({ type: 'coin_credit' }), // credited purchases
      Wallet.find({}).lean(),
    ]);

  // Current holdings, summed from real wallet fields.
  let coinsCirculating = 0; // coins + pendingCoins held across all wallets
  let cashbackIssued = 0;   // confirmed + pending ₹ cashback (legacy pool)
  for (const w of wallets) {
    coinsCirculating += (w.coins || 0) + (w.pendingCoins || 0);
    cashbackIssued   += (w.confirmedCashback || 0) + (w.pendingCashback || 0);
  }

  // Coins issued vs redeemed straight from the transaction ledger.
  const [creditAgg, debitAgg] = await Promise.all([
    Transaction.aggregate([
      { $match: { type: 'coin_credit' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'coin_debit' } },
      { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } },
    ]),
  ]);
  const coinsIssued = creditAgg[0]?.total || 0;
  const coinsRedeemed = debitAgg[0]?.total || 0;

  // Top deals by real click volume (only ones that have any clicks).
  const topDealsRaw = await Deal.find().sort({ clickCount: -1 }).limit(5).lean();
  const topDeals = topDealsRaw
    .filter((d) => (d.clickCount || 0) > 0)
    .map((d) => ({ brand: d.brand, title: d.title, revenue: 0, orders: d.clickCount || 0 }));

  // Top earners by lifetime earnings (excludes zero-earners).
  const topWallets = await Wallet.find()
    .sort({ lifetimeEarned: -1 })
    .limit(5)
    .populate('userId', 'name email')
    .lean();
  const topUsers = topWallets
    .filter((w) => w.userId && (w.lifetimeEarned || 0) > 0)
    .map((w) => ({ name: w.userId.name, email: w.userId.email, earned: w.lifetimeEarned || 0, orders: 0 }));

  res.json({
    status: 'success',
    data: {
      stats: {
        totalClicks,
        conversions,
        cashbackIssued,
        activeUsers,
      },
      coinsEconomy: {
        issued: coinsIssued,
        redeemed: coinsRedeemed,
        circulation: coinsCirculating,
      },
      topDeals,
      topUsers,
      totalUsers,
      totalDeals,
    },
  });
};

export const getUsers = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const search = req.query.search || '';

  const query = search
    ? {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-passwordHash -refreshTokens')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  res.json({
    status: 'success',
    data: { users, total, page, pages: Math.ceil(total / limit) },
  });
};

export const getAllDeals = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const [deals, total] = await Promise.all([
    Deal.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Deal.countDocuments(),
  ]);

  res.json({
    status: 'success',
    data: { deals, total, page, pages: Math.ceil(total / limit) },
  });
};
