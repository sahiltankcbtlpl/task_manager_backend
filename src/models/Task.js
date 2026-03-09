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
        required: true,
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
module.exports = mongoose.model('Task', taskSchema);
