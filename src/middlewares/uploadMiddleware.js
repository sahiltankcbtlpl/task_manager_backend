const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Check file type
function checkFileType(file, cb) {
    const filetypes = /jpeg|jpg|png|pdf|doc|docx|mp4/;

    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    const mimetype =
        filetypes.test(file.mimetype) ||
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'video/mp4';

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error('Error: Images, Videos, PDFs and Docs Only!'));
    }
}

// Function to dynamically create upload middleware
function createUploadMiddleware(folder, prefix) {
    const uploadDir = `uploads/${folder}`;
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, uploadDir);
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, prefix + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    });

    return multer({
        storage: storage,
        limits: {
            fileSize: 200 * 1024 * 1024 // 200MB
        },
        fileFilter: function (req, file, cb) {
            checkFileType(file, cb);
        }
    });
}

// Export distinct uploaders
const uploadTask = createUploadMiddleware('tasks', 'task');
const uploadDocument = createUploadMiddleware('documents', 'doc');
const uploadCompanyLogo = createUploadMiddleware('companies', 'logo');

module.exports = {
    uploadTask,
    uploadDocument,
    uploadCompanyLogo
};