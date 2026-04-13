const mongoose = require('mongoose');

const deleteAdmin = async (req, res) => {
  const Admin = mongoose.model('Admin');
  const AdminPassword = mongoose.model('AdminPassword');

  const { id } = req.params;

  const admin = await Admin.findOne({ _id: id, removed: false });

  if (!admin) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'Admin not found.',
    });
  }

  if (admin.role === 'owner') {
    return res.status(403).json({
      success: false,
      result: null,
      message: 'Cannot delete the account owner.',
    });
  }

  await Admin.findOneAndUpdate(
    { _id: id },
    { $set: { removed: true } },
    { new: true }
  ).exec();

  await AdminPassword.findOneAndUpdate(
    { user: id },
    { $set: { removed: true } },
    { new: true }
  ).exec();

  return res.status(200).json({
    success: true,
    result: null,
    message: 'Admin deleted successfully.',
  });
};

module.exports = deleteAdmin;