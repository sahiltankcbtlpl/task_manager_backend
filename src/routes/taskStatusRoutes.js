const express = require('express');
const router = express.Router();
const {
    createTaskStatus,
    getTaskstatus,
    getTaskStatusById,
    updateTaskStatus,
    deleteTaskStatus
} = require('../controllers/taskStatusController');
const { protect } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/role');

router.use(protect);

router.route('/')
    .post(checkPermission('task_status-create'), createTaskStatus)
    .get(checkPermission('task_status-read'), getTaskstatus);

router.route('/:id')
    .get(checkPermission('task_status-read'), getTaskStatusById)
    .put(checkPermission('task_status-update'), updateTaskStatus)
    .delete(checkPermission('task_status-delete'), deleteTaskStatus);

module.exports = router;
