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
const multer = require('multer');

// Reusing multer configuration similar to tasks (or defining a basic one if not found nearby)
// Since we don't have visibility into exact task attachment multer, we will create a simple safe one
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});
const upload = multer({ storage: storage });

router.route('/')
    .get(protect, getDocuments)
    .post(protect, upload.single('file'), createDocument);

router.route('/:id/request-review')
    .post(protect, requestReview);

router.route('/:id/request-access')
    .post(protect, requestAccess);

router.route('/:id/respond-review')
    .put(protect, respondToReview);


router.route('/:id/autosave')
    .patch(protect, autosaveDocument);

router.route('/:id')
    .put(protect, upload.single('file'), updateDocument)
    .delete(protect, deleteDocument);

module.exports = router;
