const mongoose = require('mongoose');

const documentPageSchema = new mongoose.Schema({
    doc_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
        required: true,
    },
    pageNo: {
        type: Number,
        required: true,
    },
    pageContent: {
        type: String,
        default: '',
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }
}, { timestamps: true });

// Ensure a particular page number is unique per document to prevent duplicates
documentPageSchema.index({ doc_id: 1, pageNo: 1 }, { unique: true });

module.exports = mongoose.model('DocumentPage', documentPageSchema);
