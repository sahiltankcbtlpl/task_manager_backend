const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        default: null, // null for system default roles (Super Admin, Company Owner)
    },
    permissions: [{
        type: String,
    }],
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Deleted'],
        default: 'Active',
    },
}, { timestamps: true });

// Compound unique index for name per company (within a company)
roleSchema.index({ name: 1, company: 1 }, { unique: true });

module.exports = mongoose.model('Role', roleSchema);
