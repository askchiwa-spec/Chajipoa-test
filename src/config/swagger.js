const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ChajiPoa API',
      version: '1.0.0',
      description: 'Power Bank Rental Platform API Documentation',
      contact: {
        name: 'ChajiPoa Team',
        email: 'support@chajipoa.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development server'
      },
      {
        url: 'https://api.chajipoa.com/api/v1',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            phone_number: {
              type: 'string'
            },
            email: {
              type: 'string',
              format: 'email'
            },
            first_name: {
              type: 'string'
            },
            last_name: {
              type: 'string'
            },
            user_type: {
              type: 'string',
              enum: ['regular', 'tourist', 'corporate']
            },
            account_status: {
              type: 'string',
              enum: ['active', 'suspended', 'blocked']
            },
            deposit_balance: {
              type: 'number',
              format: 'decimal'
            }
          }
        },
        Device: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            device_code: {
              type: 'string'
            },
            current_status: {
              type: 'string',
              enum: ['available', 'rented', 'maintenance', 'lost']
            },
            battery_level: {
              type: 'integer',
              minimum: 0,
              maximum: 100
            },
            station_id: {
              type: 'string',
              format: 'uuid'
            }
          }
        },
        Rental: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            rental_code: {
              type: 'string'
            },
            user_id: {
              type: 'string',
              format: 'uuid'
            },
            device_id: {
              type: 'string',
              format: 'uuid'
            },
            rental_status: {
              type: 'string',
              enum: ['active', 'completed', 'overdue', 'lost']
            },
            start_time: {
              type: 'string',
              format: 'date-time'
            },
            end_time: {
              type: 'string',
              format: 'date-time'
            },
            total_amount: {
              type: 'number'
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error description'
            },
            error: {
              type: 'object'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js']
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;