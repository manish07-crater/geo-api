const Joi = require("joi");

exports.generateKeySchema = Joi.object({
  name: Joi.string().min(3).max(50).required().messages({
    "string.empty": "Name cannot be empty",
    "string.min": "Name should have a minimum length of 3",
    "any.required": "Name is a required field"
  }),
  email: Joi.string().email().optional().messages({
    "string.email": "Please provide a valid email"
  }) // added email for future readiness
});
