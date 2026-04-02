const express = require('express');
const router = express.Router();
const {
    createPermission,
    getPermissions,
    updatePermission,
    deletePermission
} = require('../controllers/permissionController');
const { protect } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/role');

// All routes require login
router.use(protect);

// Allow Super Admin to manage permissions
// Note: We bypassed checkPermission for Super Admin in middleware, 
// so we don't strictly need to check for a specific permission here 
// IF we assume only Super Admin should manage this. 
// But good practice: checkPermission('MANAGE_ROLES')

router.route('/')
    .post(checkPermission('permissions-create'), createPermission)
    .get(getPermissions); // Any authenticated user can read permissions (needed by RoleForm)

router.route('/:id')
    .put(checkPermission('permissions-update'), updatePermission)
    .delete(checkPermission('permissions-delete'), deletePermission);

module.exports = router;
