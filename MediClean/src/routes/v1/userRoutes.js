import express from 'express';
import {
  handleGetProfile,
  handleUpdateProfile,
  handleChangePassword,
  handleListUsers,
  handleCreateUser,
  handleUpdateUser,
  handleDeleteUser,
  handleGetPreferences,
  handleUpdatePreferences,
  handleGetNotifications,
  handleMarkNotificationsRead
} from '../controllers/userController.js';

import { authMiddleware } from '../middlewares/authMiddlewares.js';
import { searchLimiter } from '../middlewares/rateLimiter.js';
import { searchUsers } from '../repositories/userRepository.js';

const router = express.Router();

//
// PUBLIC: Search users (rate-limited)
//
router.get('/search', searchLimiter, async (req, res) => {
  try {
    const query = req.query.q;
    const users = await searchUsers(query);
    res.json(users);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

//
// PROFILE MANAGEMENT
//
router.get('/profile', authMiddleware, handleGetProfile);
router.put('/profile', authMiddleware, handleUpdateProfile);
router.put('/password', authMiddleware, handleChangePassword);

//
// USER MANAGEMENT (ADMIN ONLY)
//
router.get('/users', authMiddleware(['admin']), handleListUsers);
router.post('/users', authMiddleware(['admin']), handleCreateUser);
router.put('/users/:id', authMiddleware(['admin']), handleUpdateUser);
router.delete('/users/:id', authMiddleware(['admin']), handleDeleteUser);

//
// USER PREFERENCES
//
router.get('/preferences', authMiddleware, handleGetPreferences);
router.put('/preferences', authMiddleware, handleUpdatePreferences);

//
// NOTIFICATIONS
//
router.get('/notifications', authMiddleware, handleGetNotifications);
router.put('/notifications/read', authMiddleware, handleMarkNotificationsRead);

export default router;
