const express = require('express');
const router = express.Router();
const {
    createStaff,
    getUsers,
    getUserById,
    updateUser,
    deleteUser
} = require('../controllers/userController');
const { protect } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/role');

router.use(protect);

router.route('/')
    .post(checkPermission('users-create'), createStaff)
    .get(checkPermission('users-read'), getUsers);

router.route('/:id')
    .get(checkPermission('users-read'), getUserById)
    .put(checkPermission('users-update'), updateUser)
    .delete(checkPermission('users-delete'), deleteUser);

module.exports = router;
