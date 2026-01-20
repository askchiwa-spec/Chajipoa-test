// src/schemas/payment.schema.js
// Payment validation schema for AzamPay integration

const Joi = require('joi');

const paymentSchema = Joi.object({
    amount: Joi.number()
        .positive()
        .required()
        .messages({
            'number.positive': 'Amount must be greater than 0',
            'any.required': 'Amount is required'
        }),
    
    currency: Joi.string()
        .valid('TZS', 'USD', 'EUR')
        .default('TZS')
        .messages({
            'any.only': 'Currency must be TZS, USD, or EUR'
        }),
    
    mobile: Joi.string()
        .pattern(/^(\+255|255|0)[67][0-9]{8}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid Tanzanian mobile number format',
            'any.required': 'Mobile number is required'
        }),
    
    provider: Joi.string()
        .valid('Mpesa', 'Tigo', 'Airtel', 'Halopesa')
        .required()
        .messages({
            'any.only': 'Provider must be Mpesa, Tigo, Airtel, or Halopesa',
            'any.required': 'Provider is required'
        }),
    
    externalId: Joi.string()
        .optional()
        .max(100)
        .messages({
            'string.max': 'External ID cannot exceed 100 characters'
        }),
    
    redirectFailURL: Joi.string()
        .uri()
        .optional()
        .messages({
            'string.uri': 'Invalid redirect fail URL format'
        }),
    
    redirectSuccessURL: Joi.string()
        .uri()
        .optional()
        .messages({
            'string.uri': 'Invalid redirect success URL format'
        }),
    
    description: Joi.string()
        .optional()
        .max(255)
        .messages({
            'string.max': 'Description cannot exceed 255 characters'
        })
});

module.exports = paymentSchema;