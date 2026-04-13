const createUserController = require('@/controllers/middlewaresControllers/createUserController');

const create = require('./create');
const list = require('./list');
const update = require('./update');
const deleteAdmin = require('./delete');
const search = require('./search');

const userController = createUserController('Admin');

const adminController = {
  ...userController,
  create,
  list,
  update,
  delete: deleteAdmin,
  search,
};

module.exports = adminController;