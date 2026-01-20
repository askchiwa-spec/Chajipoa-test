// src/schemas/payment-link.schema.js
// Payment link validation schema

const Joi = require('joi');

const paymentLinkSchema = Joi.object({
    amount: Joi.number()
        .positive()
        .required()
        .messages({
            'number.positive': 'Amount must be greater than 0',
            'any.required': 'Amount is required'
        }),
    
    currency: Joi.string()
        .valid('TZS', 'USD', 'EUR')
        .default('TZS'),
    
    buyerEmail: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Invalid email format',
            'any.required': 'Buyer email is required'
        }),
    
    buyerName: Joi.string()
        .required()
        .min(2)
        .max(100)
        .messages({
            'string.min': 'Buyer name must be at least 2 characters',
            'string.max': 'Buyer name cannot exceed 100 characters',
            'any.required': 'Buyer name is required'
        }),
    
    buyerPhonenumber: Joi.string()
        .pattern(/^(\+255|255|0)[67][0-9]{8}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid Tanzanian phone number format',
            'any.required': 'Buyer phone number is required'
        }),
    
    externalId: Joi.string()
        .optional()
        .max(100),
    
    redirectFailURL: Joi.string()
        .uri()
        .optional(),
    
    redirectSuccessURL: Joi.string()
        .uri()
        .optional(),
    
    cartItems: Joi.array()
        .items(Joi.object({
            name: Joi.string().required(),
            amount: Joi.number().positive().required(),
            quantity: Joi.number().integer().positive().required(),
            currency: Joi.string().valid('TZS', 'USD', 'EUR').default('TZS')
        }))
        .optional()
        .max(50)
        .messages({
            'array.max': 'Cannot have more than 50 cart items'
        }),
    
    description: Joi.string()
        .optional()
        .max(500)
        .messages({
            'string.max': 'Description cannot exceed 500 characters'
        })
});

module.exports = paymentLinkSchema;