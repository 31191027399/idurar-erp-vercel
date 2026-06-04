const createUserController = require('../../middlewaresControllers/createUserController');

const create = require('./create');
const list = require('./list');
const update = require('./update');
const deleteAdmin = require('./delete');
const search = require('./search');
const maintenance = require('./maintenance');
const apiKey = require('./apiKey');
const integration = require('./integration');

const userController = createUserController('Admin');

const adminController = {
  ...userController,
  create,
  list,
  update,
  delete: deleteAdmin,
  search,
  maintenance,
  apiKey,
  integration,
};

module.exports = adminController;
