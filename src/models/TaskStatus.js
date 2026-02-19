const mongoose = require('mongoose');

const taskStatusSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'deleted'],
        default: 'active',
    },
}, { timestamps: true });

module.exports = mongoose.model('TaskStatus', taskStatusSchema, 'taskstatus');
