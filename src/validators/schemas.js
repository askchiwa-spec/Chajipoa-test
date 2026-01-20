const Joi = require('joi');

// User validation schemas
const userSchemas = {
  register: Joi.object({
    phone_number: Joi.string()
      .pattern(/^(\+255|255|0)[67][0-9]{8}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid Tanzanian phone number format',
        'any.required': 'Phone number is required'
      }),
    first_name: Joi.string()
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.min': 'First name must be at least 2 characters',
        'string.max': 'First name must be less than 50 characters',
        'any.required': 'First name is required'
      }),
    last_name: Joi.string()
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.min': 'Last name must be at least 2 characters',
        'string.max': 'Last name must be less than 50 characters',
        'any.required': 'Last name is required'
      }),
    email: Joi.string()
      .email()
      .optional()
      .messages({
        'string.email': 'Invalid email format'
      }),
    national_id: Joi.string()
      .min(5)
      .max(20)
      .optional()
      .messages({
        'string.min': 'National ID must be at least 5 characters',
        'string.max': 'National ID must be less than 20 characters'
      })
  }),

  login: Joi.object({
    phone_number: Joi.string()
      .pattern(/^(\+255|255|0)[67][0-9]{8}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid Tanzanian phone number format',
        'any.required': 'Phone number is required'
      }),
    otp: Joi.string()
      .length(6)
      .pattern(/^\d+$/)
      .required()
      .messages({
        'string.length': 'OTP must be 6 digits',
        'string.pattern.base': 'OTP must contain only digits',
        'any.required': 'OTP is required'
      })
  }),

  sendOtp: Joi.object({
    phone_number: Joi.string()
      .pattern(/^(\+255|255|0)[67][0-9]{8}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid Tanzanian phone number format',
        'any.required': 'Phone number is required'
      })
  }),

  updateProfile: Joi.object({
    first_name: Joi.string()
      .min(2)
      .max(50)
      .optional(),
    last_name: Joi.string()
      .min(2)
      .max(50)
      .optional(),
    email: Joi.string()
      .email()
      .optional(),
    national_id: Joi.string()
      .min(5)
      .max(20)
      .optional()
  })
};

// Rental validation schemas
const rentalSchemas = {
  startRental: Joi.object({
    device_code: Joi.string()
      .pattern(/^PB\d{6}[A-Z0-9]{4}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid device code format',
        'any.required': 'Device code is required'
      }),
    station_id: Joi.string()
      .guid({ version: ['uuidv4'] })
      .required()
      .messages({
        'string.guid': 'Invalid station ID format',
        'any.required': 'Station ID is required'
      })
  }),

  endRental: Joi.object({
    station_id: Joi.string()
      .guid({ version: ['uuidv4'] })
      .optional()
      .messages({
        'string.guid': 'Invalid station ID format'
      })
  }),

  extendRental: Joi.object({
    extension_hours: Joi.number()
      .integer()
      .min(1)
      .max(24)
      .required()
      .messages({
        'number.integer': 'Extension hours must be a whole number',
        'number.min': 'Extension hours must be at least 1 hour',
        'number.max': 'Extension hours cannot exceed 24 hours',
        'any.required': 'Extension hours is required'
      })
  })
};

// Payment validation schemas
const paymentSchemas = {
  initiatePayment: Joi.object({
    amount: Joi.number()
      .positive()
      .precision(2)
      .required()
      .messages({
        'number.positive': 'Amount must be positive',
        'number.precision': 'Amount must have at most 2 decimal places',
        'any.required': 'Amount is required'
      }),
    phone_number: Joi.string()
      .pattern(/^(\+255|255|0)[67][0-9]{8}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid Tanzanian phone number format',
        'any.required': 'Phone number is required'
      }),
    provider: Joi.string()
      .valid('mpesa', 'tigopesa', 'airtelmoney', 'halopesa')
      .required()
      .messages({
        'any.only': 'Provider must be one of: mpesa, tigopesa, airtelmoney, halopesa',
        'any.required': 'Provider is required'
      }),
    rental_id: Joi.string()
      .guid({ version: ['uuidv4'] })
      .optional()
      .messages({
        'string.guid': 'Invalid rental ID format'
      })
  })
};

// Device validation schemas
const deviceSchemas = {
  updateStatus: Joi.object({
    status: Joi.string()
      .valid('available', 'rented', 'maintenance', 'lost')
      .required()
      .messages({
        'any.only': 'Status must be one of: available, rented, maintenance, lost',
        'any.required': 'Status is required'
      }),
    battery_level: Joi.number()
      .integer()
      .min(0)
      .max(100)
      .optional()
      .messages({
        'number.integer': 'Battery level must be a whole number',
        'number.min': 'Battery level must be between 0 and 100',
        'number.max': 'Battery level must be between 0 and 100'
      }),
    notes: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': 'Notes must be less than 500 characters'
      })
  }),

  maintenanceLog: Joi.object({
    maintenance_type: Joi.string()
      .valid('routine', 'repair', 'replacement', 'upgrade')
      .required()
      .messages({
        'any.only': 'Maintenance type must be one of: routine, repair, replacement, upgrade',
        'any.required': 'Maintenance type is required'
      }),
    description: Joi.string()
      .required()
      .messages({
        'any.required': 'Description is required'
      }),
    cost: Joi.number()
      .positive()
      .precision(2)
      .optional()
      .messages({
        'number.positive': 'Cost must be positive',
        'number.precision': 'Cost must have at most 2 decimal places'
      }),
    technician_name: Joi.string()
      .max(100)
      .optional()
      .messages({
        'string.max': 'Technician name must be less than 100 characters'
      })
  })
};

// Validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    req.validatedBody = value;
    next();
  };
};

module.exports = {
  userSchemas,
  rentalSchemas,
  paymentSchemas,
  deviceSchemas,
  validate
};