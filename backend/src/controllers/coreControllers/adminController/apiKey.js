const crypto = require('crypto');
const Joi = require('joi');
const mongoose = require('mongoose');

const buildKeyHash = (rawKey) => crypto.createHash('sha256').update(rawKey).digest('hex');

const generateRawKey = () => `idurar_${crypto.randomBytes(32).toString('hex')}`;

const create = async (req, res) => {
  const AdminApiKey = mongoose.model('AdminApiKey');
  const currentAdmin = req.admin;

  const objectSchema = Joi.object({
    name: Joi.string().trim().min(3).max(100).required(),
    scopes: Joi.array().items(Joi.string().trim().min(1)).default([]),
    expiresInDays: Joi.number().integer().min(1).max(3650).allow(null),
  });

  const { error, value } = objectSchema.validate(req.body || {});

  if (error) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'Invalid API key payload.',
      errorMessage: error.message,
    });
  }

  const rawKey = generateRawKey();
  const keyHash = buildKeyHash(rawKey);
  const expiresAt =
    typeof value.expiresInDays === 'number'
      ? new Date(Date.now() + value.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  const createdKey = await new AdminApiKey({
    user: currentAdmin._id,
    createdBy: currentAdmin._id,
    name: value.name,
    keyHash,
    keyPrefix: rawKey.slice(0, 18),
    scopes: value.scopes,
    expiresAt,
  }).save();

  return res.status(200).json({
    success: true,
    result: {
      _id: createdKey._id,
      name: createdKey.name,
      key: rawKey,
      keyPrefix: createdKey.keyPrefix,
      scopes: createdKey.scopes,
      expiresAt: createdKey.expiresAt,
      created: createdKey.created,
    },
    message: 'API key created successfully. Store it now because it will not be shown again.',
  });
};

const list = async (req, res) => {
  const AdminApiKey = mongoose.model('AdminApiKey');
  const currentAdmin = req.admin;

  const apiKeys = await AdminApiKey.find({
    user: currentAdmin._id,
    removed: false,
  })
    .select('-keyHash')
    .sort({ created: -1 })
    .lean();

  return res.status(200).json({
    success: true,
    result: apiKeys,
    message: 'Successfully found API keys',
  });
};

const revoke = async (req, res) => {
  const AdminApiKey = mongoose.model('AdminApiKey');
  const currentAdmin = req.admin;

  const revokedKey = await AdminApiKey.findOneAndUpdate(
    {
      _id: req.params.id,
      user: currentAdmin._id,
      removed: false,
      revoked: false,
    },
    {
      $set: {
        revoked: true,
        revokedAt: new Date(),
      },
    },
    { new: true }
  )
    .select('-keyHash')
    .lean();

  if (!revokedKey) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'API key not found.',
    });
  }

  return res.status(200).json({
    success: true,
    result: revokedKey,
    message: 'API key revoked successfully.',
  });
};

module.exports = {
  create,
  list,
  revoke,
};
