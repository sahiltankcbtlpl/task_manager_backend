const mongoose = require('mongoose');

const taskStatusSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'deleted'],
        default: 'active',
    },
}, { timestamps: true });

// Compound unique index for name per project (within a company)
taskStatusSchema.index({ name: 1, project: 1 }, { unique: true });

module.exports = mongoose.model('TaskStatus', taskStatusSchema, 'taskstatus');
