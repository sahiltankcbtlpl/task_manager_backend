const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
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
    taskStatus: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TaskStatus',
        // required: true,
    },
    status: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Permission',
    },
    assignee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    attachment: {
        filename: String,
        path: String,
        mimetype: String,
        size: Number
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
    }]
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
