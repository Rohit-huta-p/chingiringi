import Address from './addressModel.js';

// @desc    Get all addresses for current user
// @route   GET /api/addresses
// @access  Private
export const getAddresses = async (req, res) => {
  const addresses = await Address.find({ userId: req.user._id })
    .sort('-isDefault createdAt')
    .lean();

  res.status(200).json({ status: 'success', data: { addresses } });
};

// @desc    Create address
// @route   POST /api/addresses
// @access  Private
export const createAddress = async (req, res) => {
  const addressCount = await Address.countDocuments({ userId: req.user._id });

  const address = await Address.create({
    ...req.body,
    userId: req.user._id,
    isDefault: addressCount === 0,
  });

  res.status(201).json({ status: 'success', data: { address } });
};

// @desc    Update address
// @route   PUT /api/addresses/:id
// @access  Private
export const updateAddress = async (req, res) => {
  const address = await Address.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    req.body,
    { new: true, runValidators: true }
  );

  if (!address) {
    res.status(404);
    throw new Error('Address not found');
  }

  res.status(200).json({ status: 'success', data: { address } });
};

// @desc    Delete address
// @route   DELETE /api/addresses/:id
// @access  Private
export const deleteAddress = async (req, res) => {
  const address = await Address.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!address) {
    res.status(404);
    throw new Error('Address not found');
  }

  // If deleted address was default, make the first remaining one default
  if (address.isDefault) {
    await Address.findOneAndUpdate(
      { userId: req.user._id },
      { isDefault: true }
    );
  }

  res.status(200).json({ status: 'success', message: 'Address deleted' });
};

// @desc    Set address as default
// @route   PATCH /api/addresses/:id/default
// @access  Private
export const setDefaultAddress = async (req, res) => {
  // Unset current default
  await Address.updateMany(
    { userId: req.user._id },
    { isDefault: false }
  );

  const address = await Address.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { isDefault: true },
    { new: true }
  );

  if (!address) {
    res.status(404);
    throw new Error('Address not found');
  }

  res.status(200).json({ status: 'success', data: { address } });
};
