const request = require('supertest');
const app = require('../src/server');

describe('Rental API Tests', () => {
  let authToken;
  let userId;

  // Setup - register and login a test user
  beforeAll(async () => {
    // Register test user
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        phone_number: '+255712345678',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com'
      });

    // Verify phone (in real scenario, we'd get OTP from SMS)
    const loginResponse = await request(app)
      .post('/api/v1/auth/verify-phone')
      .send({
        phone_number: '+255712345678',
        otp: '123456' // Mock OTP
      });

    authToken = loginResponse.body.token;
    userId = loginResponse.body.data.user.id;
  });

  describe('POST /api/v1/rentals/start', () => {
    it('should start a new rental successfully', async () => {
      const rentalData = {
        device_code: 'PB001234',
        station_id: '550e8400-e29b-41d4-a716-446655440000'
      };

      const response = await request(app)
        .post('/api/v1/rentals/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send(rentalData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rental).toHaveProperty('rental_code');
      expect(response.body.data.rental).toHaveProperty('device_code');
    });

    it('should reject rental when user has active rental', async () => {
      const rentalData = {
        device_code: 'PB005678',
        station_id: '550e8400-e29b-41d4-a716-446655440001'
      };

      const response = await request(app)
        .post('/api/v1/rentals/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send(rentalData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already have an active rental');
    });
  });

  describe('GET /api/v1/rentals/active', () => {
    it('should return active rental information', async () => {
      const response = await request(app)
        .get('/api/v1/rentals/active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rental).toHaveProperty('rental_code');
      expect(response.body.data.rental).toHaveProperty('time_remaining_ms');
    });
  });

  describe('POST /api/v1/rentals/:id/extend', () => {
    it('should extend rental period successfully', async () => {
      const response = await request(app)
        .post('/api/v1/rentals/123/extend')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          extension_hours: 2
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rental).toHaveProperty('additional_amount');
    });
  });

  describe('POST /api/v1/rentals/:id/end', () => {
    it('should end rental successfully', async () => {
      const response = await request(app)
        .post('/api/v1/rentals/123/end')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          station_id: '550e8400-e29b-41d4-a716-446655440002'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rental).toHaveProperty('total_amount');
    });
  });

  describe('Authentication Requirements', () => {
    it('should require authentication for rental endpoints', async () => {
      const response = await request(app)
        .post('/api/v1/rentals/start')
        .send({})
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Input Validation', () => {
    it('should validate required fields for start rental', async () => {
      const response = await request(app)
        .post('/api/v1/rentals/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate extension hours range', async () => {
      const response = await request(app)
        .post('/api/v1/rentals/123/extend')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          extension_hours: 30 // Too high
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});