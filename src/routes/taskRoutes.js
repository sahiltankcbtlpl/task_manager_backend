const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
    createTask,
    getTasks,
    getTaskById,
    updateTask,
    deleteTask,
    bulkUploadTasks
} = require('../controllers/taskController');
const { protect } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/role');
const upload = require('../middlewares/uploadMiddleware');

router.use(protect);

const excelUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.mimetype === 'application/vnd.ms-excel') {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files (.xlsx, .xls) are allowed!'));
        }
    }
});

const uploadFields = upload.fields([
    { name: 'attachments', maxCount: 10 },
    { name: 'videoAttachments', maxCount: 5 }
]);

router.route('/bulk-upload')
    .post(checkPermission('tasks-create'), excelUpload.single('file'), bulkUploadTasks);

router.route('/')
    .post(checkPermission('tasks-create'), uploadFields, createTask)
    .get(getTasks); // Controller handles filtering based on user role/permissions

router.route('/:id')
    .get(checkPermission('tasks-read'), getTaskById)
    .put(checkPermission('tasks-update'), uploadFields, updateTask)
    .delete(checkPermission('tasks-delete'), deleteTask);

module.exports = router;
