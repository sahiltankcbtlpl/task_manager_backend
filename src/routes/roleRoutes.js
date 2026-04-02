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
    .post(checkPermission('MANAGE_ROLES'), createRole)
    .get(getRoles); // Any authenticated user can read roles (needed for role dropdowns)

router.route('/:id')
    .get(getRoleById) // Any authenticated user can get a role by ID
    .put(checkPermission('MANAGE_ROLES'), updateRole)
    .delete(checkPermission('MANAGE_ROLES'), deleteRole);

module.exports = router;
