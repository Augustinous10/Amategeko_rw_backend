const express = require('express');
const router = express.Router();
const { 
  startExam, 
  getExam, 
  submitAnswer, 
  submitExam,
  getHistory,
  reviewExam,
  getExamStats
} = require('../controllers/exam.controller');
const { authenticate } = require('../middlewares/auth');
const { hasActiveSubscription, hasExamAttempts } = require('../middlewares/validateSubscription');

// All routes require authentication
router.use(authenticate);

// Start exam - requires active subscription and available attempts
router.post('/start', hasActiveSubscription, hasExamAttempts, startExam);

// Exam actions
router.get('/history', getHistory);
router.get('/stats', getExamStats);
router.get('/:id', getExam);
router.post('/:id/answer', submitAnswer);
router.post('/:id/submit', submitExam);
router.get('/:id/review', reviewExam);

module.exports = router;