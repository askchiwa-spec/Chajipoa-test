const express = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../validators/schemas');
const { rentalSchemas } = require('../validators/schemas');
const rentalController = require('../controllers/RentalController');
const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * /rentals/start:
 *   post:
 *     summary: Start a new rental
 *     tags: [Rentals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - device_code
 *               - station_id
 *             properties:
 *               device_code:
 *                 type: string
 *                 example: "PB001234"
 *               station_id:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       201:
 *         description: Rental started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Rental started successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     rental:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         rental_code:
 *                           type: string
 *                         device_code:
 *                           type: string
 *                         station_name:
 *                           type: string
 *                         start_time:
 *                           type: string
 *                           format: date-time
 *                         expected_end_time:
 *                           type: string
 *                           format: date-time
 *                         deposit_amount:
 *                           type: number
 *                         initial_rental_amount:
 *                           type: number
 *                         total_amount:
 *                           type: number
 *                     return_qr:
 *                       type: string
 *                       format: uri
 */
router.post('/start', validate(rentalSchemas.startRental), rentalController.startRental);

/**
 * @swagger
 * /rentals/active:
 *   get:
 *     summary: Get user's active rental
 *     tags: [Rentals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active rental retrieved successfully
 *       404:
 *         description: No active rental found
 */
router.get('/active', rentalController.getActiveRental);

/**
 * @swagger
 * /rentals/{id}/end:
 *   post:
 *     summary: End a rental
 *     tags: [Rentals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Rental ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               station_id:
 *                 type: string
 *                 format: uuid
 *                 description: Return station ID (optional, defaults to pickup station)
 *     responses:
 *       200:
 *         description: Rental ended successfully
 */
router.post('/:id/end', validate(rentalSchemas.endRental), rentalController.endRental);

/**
 * @swagger
 * /rentals/{id}/extend:
 *   post:
 *     summary: Extend rental period
 *     tags: [Rentals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Rental ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - extension_hours
 *             properties:
 *               extension_hours:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 24
 *                 example: 2
 *     responses:
 *       200:
 *         description: Rental extended successfully
 */
router.post('/:id/extend', validate(rentalSchemas.extendRental), rentalController.extendRental);

/**
 * @swagger
 * /rentals/{id}/report-lost:
 *   post:
 *     summary: Report device as lost
 *     tags: [Rentals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Rental ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 example: "Left at restaurant"
 *     responses:
 *       200:
 *         description: Device reported as lost
 */
router.post('/:id/report-lost', rentalController.reportLostDevice);

/**
 * @swagger
 * /rentals/history:
 *   get:
 *     summary: Get user rental history
 *     tags: [Rentals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Rental history retrieved successfully
 */
router.get('/history', async (req, res, next) => {
  // Implementation to be added
  try {
    res.status(200).json({
      success: true,
      data: {
        rentals: [],
        pagination: {
          total: 0,
          limit: 20,
          offset: 0,
          pages: 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;