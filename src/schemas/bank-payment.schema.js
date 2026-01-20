// src/schemas/bank-payment.schema.js
// Bank payment validation schema

const Joi = require('joi');

const bankPaymentSchema = Joi.object({
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
    
    accountNumber: Joi.string()
        .required()
        .pattern(/^\d{10,15}$/)
        .messages({
            'string.pattern.base': 'Invalid account number format',
            'any.required': 'Account number is required'
        }),
    
    bankName: Joi.string()
        .valid('CRDB', 'NMB')
        .required()
        .messages({
            'any.only': 'Bank must be CRDB or NMB',
            'any.required': 'Bank name is required'
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
    
    description: Joi.string()
        .optional()
        .max(255)
});

module.exports = bankPaymentSchema;