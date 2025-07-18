const Joi = require("joi");

const signupValidator = (user) => {
  const schema = Joi.object({
    firstName: Joi.string().min(3).max(255).required(),
    lastName: Joi.string().min(3).max(255).required(),
    email: Joi.string().email().required(),
    mobileNumber: Joi.string().min(10).max(15).required(),
    password: Joi.string().min(6).max(50).required(),
    confirmPassword: Joi.string().min(6).max(50).required(),
  });
  return schema.validate(user);
};

const loginValidator = (user) => {
  const schema = Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string().min(6).max(50).required(),
  });
  return schema.validate(user);
};


module.exports = { signupValidator, loginValidator};
