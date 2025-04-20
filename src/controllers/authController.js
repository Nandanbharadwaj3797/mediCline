// src/controllers/authController.js

export const handleForgotPassword = async (req, res) => {
    res.json({ message: 'Forgot password handler' });
  };
  
  export const handleResetPassword = async (req, res) => {
    res.json({ message: 'Reset password handler' });
  };
  
  export const handleVerifyEmail = async (req, res) => {
    res.json({ message: 'Verify email handler' });
  };
  
  export const handleResendVerification = async (req, res) => {
    res.json({ message: 'Resend verification handler' });
  };
  
  export const handleLogout = async (req, res) => {
    res.json({ message: 'Logout handler' });
  };
  
  export const handleRefreshToken = async (req, res) => {
    res.json({ message: 'Refresh token handler' });
  };
  
  export const handleOAuthLogin = async (req, res) => {
    res.json({ message: 'OAuth login handler' });
  };
  
  export const handleOAuthCallback = async (req, res) => {
    res.json({ message: 'OAuth callback handler' });
  };
  