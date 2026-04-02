const express = require('express');
const router = express.Router();
const {
    createDocumentPage,
    getDocumentPages,
    updateDocumentPage,
    deleteDocumentPage
} = require('../controllers/documentPageController');
const { protect } = require('../middlewares/auth');
const { checkCompanyAccess } = require('../middlewares/companyAuth');

router.use(protect);
router.use(checkCompanyAccess);

// Manage single pages
router.route('/')
    .post(createDocumentPage);

// specific page management
router.route('/:id')
    .put(updateDocumentPage)
    .delete(deleteDocumentPage);

// Get pages by parent document
router.route('/:docId')
    .get(getDocumentPages);

module.exports = router;
