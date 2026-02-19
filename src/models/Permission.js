const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    value: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'deleted'],
        default: 'active'
    }
}, { timestamps: true });

module.exports = mongoose.model('Permission', permissionSchema);
