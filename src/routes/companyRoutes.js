const express = require('express');
const router = express.Router();
const {
    getCompanies,
    getCompanyById,
    updateCompany,
    deleteCompany
} = require('../controllers/companyController');
const { protect } = require('../middlewares/auth');
const { checkCompanyAccess } = require('../middlewares/companyAuth');
const { uploadCompanyLogo } = require('../middlewares/uploadMiddleware');

// Get all companies (Super Admin only - wait, does this exist? Just protect for now, controller handles auth)
// Actually we can just use protect
router.use(protect);

router.route('/')
    .get(getCompanies);

router.route('/:id')
    .get(checkCompanyAccess, getCompanyById)
    .put(checkCompanyAccess, uploadCompanyLogo.single('logo'), updateCompany)
    .delete(protect, deleteCompany);

module.exports = router;
