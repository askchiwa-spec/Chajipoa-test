const express = require('express');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

router.post('/initiate', async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Payment initiated',
      data: {}
    });
  } catch (error) {
    next(error);
  }
});

router.post('/callback', async (req, res, next) => {
  try {
    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;