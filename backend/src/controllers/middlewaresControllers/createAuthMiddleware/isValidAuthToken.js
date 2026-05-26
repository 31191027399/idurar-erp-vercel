const jwt = require('jsonwebtoken');

const mongoose = require('mongoose');
const crypto = require('crypto');
const extractAuthSecret = require('./extractAuthSecret');

const buildKeyHash = (rawKey) => crypto.createHash('sha256').update(rawKey).digest('hex');

const isValidAuthToken = async (req, res, next, { userModel, jwtSecret = 'JWT_SECRET' }) => {
  try {
    const UserPassword = mongoose.model(userModel + 'Password');
    const User = mongoose.model(userModel);
    const UserApiKey = mongoose.model(userModel + 'ApiKey');

    const { bearerToken, apiKeyHeader } = extractAuthSecret(req);
    const token = bearerToken;
    const apiKeyCandidate = apiKeyHeader || bearerToken;
    const looksLikeJwt = typeof token === 'string' && token.split('.').length === 3;

    if (!token && !apiKeyCandidate)
      return res.status(401).json({
        success: false,
        result: null,
        message: 'No authentication token, authorization denied.',
        jwtExpired: true,
      });

    let verified = null;
    let jwtError = null;

    if (token) {
      try {
        verified = jwt.verify(token, process.env[jwtSecret]);
      } catch (error) {
        jwtError = error;
      }
    }

    if (verified) {
      const userPasswordPromise = UserPassword.findOne({ user: verified.id, removed: false });
      const userPromise = User.findOne({ _id: verified.id, removed: false });

      const [user, userPassword] = await Promise.all([userPromise, userPasswordPromise]);

      if (!user)
        return res.status(401).json({
          success: false,
          result: null,
          message: "User doens't Exist, authorization denied.",
          jwtExpired: true,
        });

      const { loggedSessions } = userPassword;

      if (!loggedSessions.includes(token))
        return res.status(401).json({
          success: false,
          result: null,
          message: 'User is already logout try to login, authorization denied.',
          jwtExpired: true,
        });

      const reqUserName = userModel.toLowerCase();
      req[reqUserName] = user;
      req.auth = { type: 'jwt' };
      next();
      return;
    }

    if (apiKeyCandidate) {
      const keyHash = buildKeyHash(apiKeyCandidate);
      const apiKeyRecord = await UserApiKey.findOne({
        keyHash,
        removed: false,
        revoked: false,
      });

      if (apiKeyRecord) {
        if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
          return res.status(401).json({
            success: false,
            result: null,
            message: 'API key has expired.',
            jwtExpired: true,
          });
        }

        const user = await User.findOne({ _id: apiKeyRecord.user, removed: false });

        if (!user) {
          return res.status(401).json({
            success: false,
            result: null,
            message: "User doens't Exist, authorization denied.",
            jwtExpired: true,
          });
        }

        await UserApiKey.findByIdAndUpdate(apiKeyRecord._id, {
          $set: { lastUsedAt: new Date() },
        }).exec();

        const reqUserName = userModel.toLowerCase();
        req[reqUserName] = user;
        req.auth = { type: 'apiKey', apiKeyId: apiKeyRecord._id };
        next();
        return;
      }
    }

    if (jwtError && looksLikeJwt) {
      return res.status(401).json({
        success: false,
        result: null,
        message: jwtError.message,
        error: jwtError,
        controller: 'isValidAuthToken',
        jwtExpired: true,
      });
    }

    return res.status(401).json({
      success: false,
      result: null,
      message: 'Token verification failed, authorization denied.',
      jwtExpired: true,
    });
  } catch (error) {
    const isJwtError =
      error?.name === 'TokenExpiredError' ||
      error?.name === 'JsonWebTokenError' ||
      error?.name === 'NotBeforeError';

    return res.status(isJwtError ? 401 : 500).json({
      success: false,
      result: null,
      message: error.message,
      error: error,
      controller: 'isValidAuthToken',
      jwtExpired: true,
    });
  }
};

module.exports = isValidAuthToken;
