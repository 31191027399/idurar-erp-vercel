const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const adminApiKeySchema = new Schema({
  removed: {
    type: Boolean,
    default: false,
  },
  user: { type: mongoose.Schema.ObjectId, ref: 'Admin', required: true },
  createdBy: { type: mongoose.Schema.ObjectId, ref: 'Admin', required: true },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  keyHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  keyPrefix: {
    type: String,
    required: true,
  },
  scopes: {
    type: [String],
    default: [],
  },
  lastUsedAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
  revoked: {
    type: Boolean,
    default: false,
  },
  revokedAt: {
    type: Date,
    default: null,
  },
  created: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('AdminApiKey', adminApiKeySchema);
