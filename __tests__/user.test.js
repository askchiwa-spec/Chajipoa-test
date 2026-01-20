const request = require('supertest');
const app = require('../src/server');

describe('User API Tests', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        phone_number: '+255712345678',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('userId');
      expect(response.body.data.phone_number).toBe('+255712345678');
    });

    it('should reject invalid phone number', async () => {
      const userData = {
        phone_number: 'invalid-phone',
        first_name: 'John',
        last_name: 'Doe'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/users/profile', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Health Check', () => {
    it('should return system health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});