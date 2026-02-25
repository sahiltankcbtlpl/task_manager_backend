const express = require('express');
const router = express.Router();
const {
    createTask,
    getTasks,
    getTaskById,
    updateTask,
    deleteTask
} = require('../controllers/taskController');
const { protect } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/role');
const upload = require('../middlewares/uploadMiddleware');

router.use(protect);

const uploadFields = upload.fields([
    { name: 'attachments', maxCount: 10 },
    { name: 'videoAttachments', maxCount: 5 }
]);

router.route('/')
    .post(checkPermission('tasks-create'), uploadFields, createTask)
    .get(getTasks); // Controller handles filtering based on user role/permissions

router.route('/:id')
    .get(checkPermission('tasks-read'), getTaskById)
    .put(checkPermission('tasks-update'), uploadFields, updateTask)
    .delete(checkPermission('tasks-delete'), deleteTask);

module.exports = router;
