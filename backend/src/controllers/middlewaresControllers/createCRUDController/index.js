const { modelsFiles } = require('../../../models/utils');

const mongoose = require('mongoose');

const create = require('./create');
const read = require('./read');
const update = require('./update');
const remove = require('./remove');
const search = require('./search');
const filter = require('./filter');
const summary = require('./summary');
const listAll = require('./listAll');
const paginatedList = require('./paginatedList');

// Load the generated Joi registry (if present). Entities without a generated
// entry fall through to today's no-validation behavior.
let generatedSchemas = {};
try {
  generatedSchemas = require('../../appControllers/_generated/entitySchemas');
} catch (err) {
  // File doesn't exist yet (no entity has been migrated). That's fine —
  // every entity falls through to no-validation behavior.
  generatedSchemas = {};
}

const createCRUDController = (modelName) => {
  if (!modelsFiles.includes(modelName)) {
    throw new Error(`Model ${modelName} does not exist`);
  }

  const Model = mongoose.model(modelName);
  const joi = generatedSchemas[modelName] || null;

  let crudMethods = {
    create: (req, res) => create(Model, req, res, joi && joi.create),
    read: (req, res) => read(Model, req, res),
    update: (req, res) => update(Model, req, res, joi && joi.update),
    delete: (req, res) => remove(Model, req, res),
    list: (req, res) => paginatedList(Model, req, res),
    listAll: (req, res) => listAll(Model, req, res),
    search: (req, res) => search(Model, req, res),
    filter: (req, res) => filter(Model, req, res),
    summary: (req, res) => summary(Model, req, res),
  };
  return crudMethods;
};

module.exports = createCRUDController;
