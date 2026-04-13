const mongoose = require('mongoose');

const search = async (req, res) => {
  const Admin = mongoose.model('Admin');

  const { q } = req.query;

  if (!q) {
    return res.status(400).json({
      success: false,
      result: [],
      message: 'No search query provided.',
    });
  }

  const result = await Admin.find({
    removed: false,
    $or: [
      { name: { $regex: new RegExp(q, 'i') } },
      { surname: { $regex: new RegExp(q, 'i') } },
      { email: { $regex: new RegExp(q, 'i') } },
    ],
  })
    .sort({ created: -1 })
    .exec();

  return res.status(200).json({
    success: true,
    result,
    message: 'Successfully searched admins.',
  });
};

module.exports = search;