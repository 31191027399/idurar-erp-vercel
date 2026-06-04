const Joi = require('joi');
const mongoose = require('mongoose');

const SETTINGS_CATEGORY = 'integration_settings';
const SETTING_KEYS = {
  serviceName: 'third_party_service_name',
  baseUrl: 'third_party_base_url',
  apiKey: 'third_party_api_key',
};

const read = async (req, res) => {
  const Setting = mongoose.model('Setting');

  const settings = await Setting.find({
    settingKey: { $in: Object.values(SETTING_KEYS) },
    removed: false,
  }).lean();

  const settingsMap = settings.reduce((accumulator, setting) => {
    accumulator[setting.settingKey] = setting.settingValue;
    return accumulator;
  }, {});

  return res.status(200).json({
    success: true,
    result: {
      serviceName: settingsMap[SETTING_KEYS.serviceName] || '',
      baseUrl: settingsMap[SETTING_KEYS.baseUrl] || '',
      apiKey: settingsMap[SETTING_KEYS.apiKey] || '',
      hasApiKey: Boolean(settingsMap[SETTING_KEYS.apiKey]),
    },
    message: 'Integration settings loaded successfully.',
  });
};

const update = async (req, res) => {
  const Setting = mongoose.model('Setting');

  const objectSchema = Joi.object({
    serviceName: Joi.string().trim().allow('').max(120).required(),
    baseUrl: Joi.string().trim().allow('').uri({ scheme: ['http', 'https'] }).max(2048).required(),
    apiKey: Joi.string().allow('').max(4096).required(),
  });

  const { error, value } = objectSchema.validate(req.body || {});

  if (error) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'Invalid integration settings payload.',
      errorMessage: error.message,
    });
  }

  const updates = [
    {
      settingKey: SETTING_KEYS.serviceName,
      settingValue: value.serviceName,
      valueType: 'string',
      isPrivate: false,
    },
    {
      settingKey: SETTING_KEYS.baseUrl,
      settingValue: value.baseUrl,
      valueType: 'string',
      isPrivate: false,
    },
    {
      settingKey: SETTING_KEYS.apiKey,
      settingValue: value.apiKey,
      valueType: 'string',
      isPrivate: true,
    },
  ];

  await Promise.all(
    updates.map(({ settingKey, settingValue, valueType, isPrivate }) =>
      Setting.findOneAndUpdate(
        { settingKey },
        {
          $set: {
            settingCategory: SETTINGS_CATEGORY,
            settingKey,
            settingValue,
            valueType,
            isPrivate,
            removed: false,
            enabled: true,
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      )
    )
  );

  return res.status(200).json({
    success: true,
    result: {
      serviceName: value.serviceName,
      baseUrl: value.baseUrl,
      apiKey: value.apiKey,
      hasApiKey: Boolean(value.apiKey),
    },
    message: 'Integration settings updated successfully.',
  });
};

module.exports = {
  read,
  update,
};
