const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    status: {
        type: String,
        enum: ['Active', 'Deleted'],
        default: 'Active',
    },
}, { timestamps: true });

module.exports = mongoose.model('Module', moduleSchema);
