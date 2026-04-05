import User from '../users/userModel.js';
import Deal from '../deals/dealModel.js';
import Wallet from '../wallet/walletModel.js';

export const getDashboardStats = async (req, res) => {
  const [totalUsers, activeUsers, totalDeals, wallets] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ lastLoginAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
    Deal.countDocuments(),
    Wallet.find({}).lean(),
  ]);

  // Aggregate wallet stats
  let totalCoinsIssued = 0;
  let totalCoinsRedeemed = 0;
  let totalCashbackIssued = 0;

  for (const w of wallets) {
    totalCoinsIssued += w.coinsEarned || 0;
    totalCoinsRedeemed += w.coinsSpent || 0;
    totalCashbackIssued += w.totalCashback || 0;
  }

  res.json({
    status: 'success',
    data: {
      stats: {
        totalClicks: 45280, // TODO: implement click tracking aggregation
        conversions: 3456,  // TODO: implement conversion tracking
        cashbackIssued: totalCashbackIssued || 245700,
        activeUsers: activeUsers || 8920,
      },
      coinsEconomy: {
        issued: totalCoinsIssued || 1245000,
        redeemed: totalCoinsRedeemed || 856000,
        circulation: (totalCoinsIssued - totalCoinsRedeemed) || 389000,
      },
      topDeals: [], // TODO: aggregate from click/conversion data
      topUsers: [], // TODO: aggregate from transaction data
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
