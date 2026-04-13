const mongoose = require('mongoose');
const { generate: uniqueId } = require('shortid');

const create = async (req, res) => {
  const Admin = mongoose.model('Admin');
  const AdminPassword = mongoose.model('AdminPassword');

  const { name, surname, email, password, role, enabled } = req.body;

  if (!password || password.length < 8) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'Password must be at least 8 characters long.',
    });
  }

  const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
  if (existingAdmin) {
    return res.status(409).json({
      success: false,
      result: null,
      message: 'Email already exists.',
    });
  }

  const salt = uniqueId();
  const AdminPasswordModel = new AdminPassword();
  const passwordHash = AdminPasswordModel.generateHash(salt, password);

  const adminData = {
    email: email.toLowerCase(),
    name,
    surname,
    role: role || 'employee',
    enabled: enabled !== undefined ? enabled : true,
    removed: false,
  };

  const result = await new Admin(adminData).save();

  const passwordData = {
    password: passwordHash,
    salt,
    user: result._id,
    emailVerified: true,
  };

  await new AdminPassword(passwordData).save();

  return res.status(200).json({
    success: true,
    result: {
      _id: result._id,
      email: result.email,
      name: result.name,
      surname: result.surname,
      role: result.role,
      enabled: result.enabled,
    },
    message: 'Admin created successfully.',
  });
};

module.exports = create;