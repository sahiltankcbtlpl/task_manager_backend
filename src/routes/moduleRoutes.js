const express = require('express');
const router = express.Router();
const {
    getModules,
    createModule,
    deleteModule
} = require('../controllers/moduleController');
const { protect } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/role');

router.use(protect);

router.route('/')
    .get(getModules)
    .post(checkPermission('modules-manage'), createModule);

router.route('/:id')
    .delete(checkPermission('modules-manage'), deleteModule);

module.exports = router;
