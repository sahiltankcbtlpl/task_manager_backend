const express = require('express');
const router = express.Router();
const { loginUser, logoutUser, getMe, updateMe, registerUser } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

router.post('/login', loginUser);
router.post('/register', registerUser);
router.post('/logout', logoutUser);
router.route('/me').get(protect, getMe).put(protect, updateMe);

module.exports = router;
