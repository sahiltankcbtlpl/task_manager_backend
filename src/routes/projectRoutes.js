const express = require('express');
const router = express.Router();

const {
    createProject,
    getProjects,
    getProjectById,
    getProjectMembers,
    updateProject,
    deleteProject,
} = require('../controllers/projectController');

const { protect } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/role');
const { checkCompanyAccess } = require('../middlewares/companyAuth');
const { checkSubscriptionLimit } = require('../middlewares/subscriptionMiddleware');

router.use(protect);
router.use(checkCompanyAccess);

router
    .route('/')
    .post(checkPermission('projects-create'), checkSubscriptionLimit('Projects'), createProject)
    .get(getProjects);

router
    .route('/:id')
    .get(getProjectById)
    .put(checkPermission('projects-update'), updateProject)
    .delete(checkPermission('projects-delete'), deleteProject);

router
    .route('/:id/members')
    .get(getProjectMembers);

module.exports = router;