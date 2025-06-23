import express from 'express';
import { body } from 'express-validator'; //validate request body data
import { checkAuth, login, register } from '../controllers/authController.js';
import { trackDailyLogin } from '../middlewares/gamificationMiddleware.js';
const router = express.Router();

// Register route
router.post('/register', [
    body('name').not().isEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Enter valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password should be of length 6 or more'),
], register);

// Login route
router.post('/login', [
    body('email').isEmail().withMessage('Enter valid email'),
    body('password').not().isEmpty().withMessage('Password is required')
],login, trackDailyLogin );

// Check session route
router.get('/check-session', checkAuth,trackDailyLogin);

export default router;