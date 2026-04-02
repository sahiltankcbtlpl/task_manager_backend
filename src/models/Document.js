const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    fileUrl: {
        type: String,
    },
    fileName: {
        type: String,
    },
    mimetype: {
        type: String,
    },
    size: {
        type: Number,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    allowedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    content: {
        type: String,
        default: ''
    },
    isEditorDocument: {
        type: Boolean,
        default: false
    },
    permissions: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        access: {
            type: String,
            enum: ['view', 'edit'],
            default: 'view'
        }
    }],
    reviewRequests: [{
        requestedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'declined'],
            default: 'pending',
        },
        requestType: {
            type: String,
            enum: ['view', 'edit'],
            default: 'view',
        }
    }]
}, { timestamps: true });

documentSchema.index({ project: 1 });
documentSchema.index({ owner: 1 });

module.exports = mongoose.model('Document', documentSchema);
