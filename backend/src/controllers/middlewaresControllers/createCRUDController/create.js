const create = async (Model, req, res, joiSchema) => {
  // Validate input if a Joi schema was provided (entity has a declaration).
  if (joiSchema) {
    const { error } = joiSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        result: null,
        message: error.details[0] ? error.details[0].message : 'Validation error',
      });
    }
  }

  // Creating a new document in the collection
  req.body.removed = false;
  const result = await new Model({
    ...req.body,
  }).save();

  // Returning successfull response
  return res.status(200).json({
    success: true,
    result,
    message: 'Successfully Created the document in Model ',
  });
};

module.exports = create;
