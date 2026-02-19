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

router.route('/')
    .post(checkPermission('tasks-create'), upload.single('attachment'), createTask)
    .get(getTasks); // Controller handles filtering based on user role/permissions

router.route('/:id')
    .get(checkPermission('tasks-read'), getTaskById)
    .put(checkPermission('tasks-update'), upload.single('attachment'), updateTask)
    .delete(checkPermission('tasks-delete'), deleteTask);

module.exports = router;
