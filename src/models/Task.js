const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        index: true,
    },
    description: {
        type: String,
        required: true,
        index: true,
    },
    mentionedUsers: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    ],
    taskStatus: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TaskStatus',
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'deleted'],
        default: 'active'
    },
    assignee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    attachments: [{
        filename: String,
        path: String,
        mimetype: String,
        size: Number
    }],
    videoAttachments: [{
        filename: String,
        path: String,
        mimetype: String,
        size: Number
    }],
    category: {
        type: String,
        enum: ['TASK', 'ISSUE'],
        default: 'TASK',
    }
}, { timestamps: true });
taskSchema.index({ project: 1, category: 1 });
taskSchema.index({ assignee: 1 });
// Add compound index to optimize the default API query filtering and sorting
taskSchema.index({ category: 1, createdAt: -1, _id: 1 });
// Add case-insensitive collation index for extremely fast duplicate checks
taskSchema.index({ name: 1, project: 1, category: 1 }, { collation: { locale: 'en', strength: 2 } });
module.exports = mongoose.model('Task', taskSchema);
