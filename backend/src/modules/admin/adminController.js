import User from '../users/userModel.js';
import Deal from '../deals/dealModel.js';
import Wallet from '../wallet/walletModel.js';
import Transaction from '../transactions/transactionModel.js';
import ClickEvent from '../clicks/clickModel.js';
import ShareEvent from '../shares/shareModel.js';
import Product from '../products/productModel.js';
import Store from '../stores/storeModel.js';
import AdminSettings from './adminSettingsModel.js';
import { pctDelta, dayWindows, trendDays, fillTrend } from './dashboardStats.js';

// Every number is aggregated live — no seed/mock. Fresh install → all zeros.
export const getDashboardStats = async (req, res) => {
  const now = new Date();
  const { today, yesterday, start30, start60 } = dayWindows(now);
  const settings = await AdminSettings.get();
  const coinsPerRupee = settings.coinsPerRupee || 1000;

  const last30 = { day: { $gte: start30 } };
  const prior30 = { day: { $gte: start60, $lt: start30 } };
  const notShare = { type: 'coin_credit', 'metadata.reason': { $ne: 'share' } };

  const [
    totalShares, sharesToday, sharesYesterday, shares30, sharesPrev30,
    uniq30, uniqPrev30, coinsAllAgg, coins30Agg, coinsPrev30Agg,
    wallets, creditAgg, debitAgg, trendRows, sharersRows, itemsRows,
    clicks, purchases, commissionAgg, activeUsers,
  ] = await Promise.all([
    ShareEvent.estimatedDocumentCount(),
    ShareEvent.countDocuments({ day: today }),
    ShareEvent.countDocuments({ day: yesterday }),
    ShareEvent.countDocuments(last30),
    ShareEvent.countDocuments(prior30),
    ShareEvent.distinct('userId', last30),
    ShareEvent.distinct('userId', prior30),
    ShareEvent.aggregate([{ $match: { status: 'confirmed' } }, { $group: { _id: null, c: { $sum: '$coinsAwarded' } } }]),
    ShareEvent.aggregate([{ $match: { ...last30, status: 'confirmed' } }, { $group: { _id: null, c: { $sum: '$coinsAwarded' } } }]),
    ShareEvent.aggregate([{ $match: { ...prior30, status: 'confirmed' } }, { $group: { _id: null, c: { $sum: '$coinsAwarded' } } }]),
    Wallet.find({}).select('coins pendingCoins').lean(),
    Transaction.aggregate([{ $match: { type: 'coin_credit' } }, { $group: { _id: null, c: { $sum: '$amount' } } }]),
    Transaction.aggregate([{ $match: { type: 'coin_debit' } }, { $group: { _id: null, c: { $sum: { $abs: '$amount' } } } }]),
    ShareEvent.aggregate([{ $match: last30 }, { $group: { _id: '$day', shares: { $sum: 1 } } }]),
    ShareEvent.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: '$userId', shares: { $sum: 1 }, coins: { $sum: '$coinsAwarded' } } },
      { $sort: { shares: -1 } }, { $limit: 5 },
    ]),
    ShareEvent.aggregate([
      { $group: { _id: { itemType: '$itemType', itemId: '$itemId' }, shares: { $sum: 1 } } },
      { $sort: { shares: -1 } }, { $limit: 5 },
    ]),
    ClickEvent.estimatedDocumentCount(),
    Transaction.countDocuments(notShare),
    Transaction.aggregate([{ $match: notShare }, { $group: { _id: null, c: { $sum: { $ifNull: ['$metadata.commissionPaid', 0] } } } }]),
    User.countDocuments({ lastLoginAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } }),
  ]);

  let circulation = 0;
  for (const w of wallets) circulation += (w.coins || 0) + (w.pendingCoins || 0);

  // Resolve top-sharer names.
  const users = await User.find({ _id: { $in: sharersRows.map((r) => r._id).filter(Boolean) } })
    .select('name email').lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const topSharers = sharersRows.map((r) => {
    const u = userById.get(String(r._id)) || {};
    return { name: u.name || 'Unknown', email: u.email || '', shares: r.shares, coins: r.coins };
  });

  // Resolve top-item names (split by type, two batched finds).
  const productIds = itemsRows.filter((r) => r._id.itemType === 'product').map((r) => r._id.itemId);
  const storeIds = itemsRows.filter((r) => r._id.itemType === 'store').map((r) => r._id.itemId);
  const [products, stores] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).select('name merchant').lean(),
    Store.find({ _id: { $in: storeIds } }).select('name').lean(),
  ]);
  const prodById = new Map(products.map((p) => [String(p._id), p]));
  const storeById = new Map(stores.map((s) => [String(s._id), s]));
  const topSharedItems = itemsRows.map((r) => {
    if (r._id.itemType === 'product') {
      const p = prodById.get(String(r._id.itemId)) || {};
      return { itemType: 'product', name: p.name || 'Unknown product', brand: p.merchant || '', shares: r.shares };
    }
    const s = storeById.get(String(r._id.itemId)) || {};
    return { itemType: 'store', name: s.name || 'Unknown store', brand: '', shares: r.shares };
  });

  const uniq30Count = uniq30.length;
  const coins30 = coins30Agg[0]?.c || 0;
  const shareTrend = fillTrend(trendDays(now), trendRows);

  res.json({
    status: 'success',
    data: {
      hero: {
        totalShares,
        sharesToday,
        coinsFromShares: coinsAllAgg[0]?.c || 0,
        liabilityRupees: Math.round(circulation / coinsPerRupee),
      },
      cards: {
        sharesToday:      { value: sharesToday,  deltaPct: pctDelta(sharesToday, sharesYesterday) },
        shares30d:        { value: shares30,     deltaPct: pctDelta(shares30, sharesPrev30) },
        uniqueSharers30d: { value: uniq30Count,  deltaPct: pctDelta(uniq30Count, uniqPrev30.length) },
        coinsIssued30d:   { value: coins30,      deltaPct: pctDelta(coins30, coinsPrev30Agg[0]?.c || 0) },
      },
      coinsEconomy: {
        issued: creditAgg[0]?.c || 0,
        redeemed: debitAgg[0]?.c || 0,
        circulation,
      },
      shareTrend,
      topSharers,
      topSharedItems,
      revenue: { clicks, purchases, commission: commissionAgg[0]?.c || 0 },
      activeUsers,
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
