import express from 'express';
import {
  handleForgotPassword,
  handleResetPassword,
  handleVerifyEmail,
  handleResendVerification,
  handleLogout,
  handleRefreshToken,
  handleOAuthLogin,
  handleOAuthCallback
} from '../../controllers/authController.js';

import { authMiddleware } from '../../middlewares/auth.js';

const router = express.Router();

//
// 🔐 Password Reset Flow
//
router.post('/forgot-password', handleForgotPassword);
router.post('/reset-password', handleResetPassword);

//
// ✉️ Email Verification
//
router.post('/verify-email', handleVerifyEmail);
router.post('/resend-verification', handleResendVerification);

//
// 🔁 Session Management
//
router.post('/logout', authMiddleware, handleLogout);
router.post('/refresh-token', handleRefreshToken);

//
// 🌐 OAuth Routes
//
router.get('/oauth/:provider', handleOAuthLogin);
router.get('/oauth/:provider/callback', handleOAuthCallback);

export default router;
