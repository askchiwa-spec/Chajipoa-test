const express = require('express');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: []
    });
  } catch (error) {
    next(error);
  }
});

router.get('/nearby', async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: []
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;