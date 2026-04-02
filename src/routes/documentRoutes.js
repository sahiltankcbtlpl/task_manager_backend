const express = require('express');
const router = express.Router();
const {
    createDocument,
    getDocuments,
    requestReview,
    respondToReview,
    updateDocument,
    deleteDocument,
    autosaveDocument,
    requestAccess
} = require('../controllers/documentController');
const { protect } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/role');
const { checkCompanyAccess } = require('../middlewares/companyAuth');
const { uploadDocument } = require('../middlewares/uploadMiddleware');

router.use(protect);
router.use(checkCompanyAccess);

router.route('/')
    .get(getDocuments)
    .post(uploadDocument.single('file'), createDocument);

router.route('/:id/request-review')
    .post(requestReview);

router.route('/:id/request-access')
    .post(requestAccess);

router.route('/:id/respond-review')
    .put(respondToReview);

router.route('/:id/autosave')
    .patch(autosaveDocument);

router.route('/:id')
    .get(getDocuments) // Reuse getDocuments or specific logic? Usually getDocumentById is missing here?
    .put(uploadDocument.single('file'), updateDocument)
    .delete(deleteDocument);

module.exports = router;
