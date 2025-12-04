const Joi = require('joi');

const validateRequest = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error } = schema.validate(req[property]);

    if (error) {
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';
      validationError.status = 400;
      validationError.details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return next(validationError);
    }

    next();
  };
};

// Validation schemas
const schemas = {
  registerBegin: Joi.object({
    userId: Joi.string().required().min(1).max(100),
    username: Joi.string().required().min(1).max(100),
    displayName: Joi.string().optional().max(100),
    platform: Joi.string().optional().valid('web', 'android', 'ios')
  }),

  registerComplete: Joi.object({
    userId: Joi.string().required(),
    sessionId: Joi.string().required(),
    credential: Joi.object().required(),
    origin: Joi.string().optional(),
    platform: Joi.string().optional().valid('web', 'android', 'ios')
  }),

  loginBegin: Joi.object({
    userId: Joi.string().optional(),
    username: Joi.string().optional(),
    platform: Joi.string().optional().valid('web', 'android', 'ios')
  }).or('userId', 'username'),

  loginComplete: Joi.object({
    sessionId: Joi.string().required(),
    credential: Joi.object().required(),
    origin: Joi.string().optional(),
    skipBackendAuth: Joi.boolean().optional().default(false)
  }),

  deletePasskey: Joi.object({
    id: Joi.string().required()
  }),

  signin: Joi.object({
    userId: Joi.string().required(),
    sessionToken: Joi.string().optional()
  })
};

module.exports = {
  validateRequest,
  schemas
};