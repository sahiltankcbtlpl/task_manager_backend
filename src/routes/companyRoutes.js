const express = require('express');
const router = express.Router();
const {
    getCompanies,
    getCompanyById,
    updateCompany,
    deleteCompany,
    updateCompanySubscription
} = require('../controllers/companyController');
const { protect } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/role');
const { checkCompanyAccess } = require('../middlewares/companyAuth');
const { uploadCompanyLogo } = require('../middlewares/uploadMiddleware');

// Base protection
router.use(protect);

router.route('/')
    .get(getCompanies);

router.route('/:id/subscription')
    .put(updateCompanySubscription);

router.route('/:id')
    .get(checkCompanyAccess, getCompanyById)
    .put(checkCompanyAccess, uploadCompanyLogo.single('logo'), updateCompany)
    .delete(deleteCompany);

module.exports = router;
