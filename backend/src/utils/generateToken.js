import jwt from 'jsonwebtoken';

// Refresh-token lifetime in days — single source of truth so the JWT `exp`
// claim, the cookie maxAge, and the DB expiresAt can't drift apart. They used
// to: the JWT read JWT_REFRESH_EXPIRATION while the cookie/DB were hardcoded to
// 30 days. Override with JWT_REFRESH_DAYS; defaults to 7.
const REFRESH_DAYS = Number(process.env.JWT_REFRESH_DAYS) || 7;
const REFRESH_MAX_AGE_MS = REFRESH_DAYS * 24 * 60 * 60 * 1000;

// Shared cookie attributes. CLEARING a cookie must use the same secure/sameSite
// as setting it — in prod (cross-site, SameSite=None) the browser silently
// drops a clearing Set-Cookie without these attrs, so logout never sticks.
export const AUTH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
};

export const generateTokens = async (res, user) => {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRATION || '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: `${REFRESH_DAYS}d` }
  );

  // Access Token Cookie
  res.cookie('accessToken', accessToken, {
    ...AUTH_COOKIE_OPTS,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  // Refresh Token Cookie
  res.cookie('refreshToken', refreshToken, {
    ...AUTH_COOKIE_OPTS,
    maxAge: REFRESH_MAX_AGE_MS,
  });

  // Keep track of refresh tokens in DB
  if (user) {
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + REFRESH_MAX_AGE_MS)
    });
    // Truncate to keep db clean (optional but good practice)
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }
    // Stamp activity on every token issuance (login/google/otp/signup/refresh) —
    // "active" counts silently-renewed sessions too. Piggybacks on the save
    // below, so it costs no extra write. Powers the dashboard's activeUsers.
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });
  }

  return { accessToken, refreshToken };
};
