const express = require('express');
const router = express.Router();

const {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    deleteProject,
} = require('../controllers/projectController');

const { protect } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/role');

router.use(protect);

router
    .route('/')
    .post(checkPermission('projects-create'), createProject)
    .get(checkPermission('projects-read'), getProjects);

router
    .route('/:id')
    .get(checkPermission('projects-read'), getProjectById)
    .put(checkPermission('projects-update'), updateProject)
    .delete(checkPermission('projects-delete'), deleteProject);

module.exports = router;