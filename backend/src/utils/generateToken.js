import jwt from 'jsonwebtoken';

export const generateTokens = async (res, user) => {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRATION || '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRATION || '30d' }
  );

  // Access Token Cookie
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Use secure cookies only in production
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Must be 'none' for cross-site subdomains in prod
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  // Refresh Token Cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  // Keep track of refresh tokens in DB
  if (user) {
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    // Truncate to keep db clean (optional but good practice)
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }
    await user.save({ validateBeforeSave: false });
  }

  return { accessToken, refreshToken };
};
