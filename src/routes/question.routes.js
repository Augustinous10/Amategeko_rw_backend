const express = require('express');
const router = express.Router();
const { 
  getQuestions, 
  getQuestion, 
  createQuestion, 
  updateQuestion, 
  deleteQuestion,
  getStats,
  checkReadiness
} = require('../controllers/question.controller');
const { authenticate, isAdmin } = require('../middlewares/auth');
const { uploadImage, uploadQuestionImages } = require('../middlewares/upload'); // ✅ Added uploadQuestionImages

// All routes require authentication and admin privileges
router.use(authenticate, isAdmin);

// Stats and readiness routes (no file upload needed)
router.get('/stats', getStats);
router.get('/readiness', checkReadiness);

// Question CRUD routes
router.get('/', getQuestions);
router.get('/:id', getQuestion);
router.post('/', uploadQuestionImages, createQuestion);        // ✅ Changed to uploadQuestionImages
router.put('/:id', uploadQuestionImages, updateQuestion);      // ✅ Changed to uploadQuestionImages
router.delete('/:id', deleteQuestion);

module.exports = router;