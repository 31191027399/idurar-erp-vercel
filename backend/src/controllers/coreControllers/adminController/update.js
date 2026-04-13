const mongoose = require('mongoose');

const update = async (req, res) => {
  const Admin = mongoose.model('Admin');

  const { id } = req.params;
  const { name, surname, email, role, enabled } = req.body;

  const existingAdmin = await Admin.findOne({
    email: email?.toLowerCase(),
    _id: { $ne: id },
    removed: false,
  });

  if (existingAdmin) {
    return res.status(409).json({
      success: false,
      result: null,
      message: 'Email already exists.',
    });
  }

  const updates = {};
  if (name) updates.name = name;
  if (surname) updates.surname = surname;
  if (email) updates.email = email.toLowerCase();
  if (role) updates.role = role;
  if (enabled !== undefined) updates.enabled = enabled;

  const result = await Admin.findOneAndUpdate(
    { _id: id, removed: false },
    { $set: updates },
    { new: true }
  ).exec();

  if (!result) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'Admin not found.',
    });
  }

  return res.status(200).json({
    success: true,
    result,
    message: 'Admin updated successfully.',
  });
};

module.exports = update;