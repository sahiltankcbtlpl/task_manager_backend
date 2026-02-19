const express = require('express');
const router = express.Router();
const {
    createRole,
    getRoles,
    getRoleById,
    updateRole,
    deleteRole
} = require('../controllers/roleController');
const { protect } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/role');

// All routes require login
router.use(protect);

router.route('/')
    .post(checkPermission('roles-create'), createRole)
    .get(checkPermission('roles-read'), getRoles);

router.route('/:id')
    .get(checkPermission('roles-read'), getRoleById)
    .put(checkPermission('roles-update'), updateRole)
    .delete(checkPermission('roles-delete'), deleteRole);

module.exports = router;
