const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },

    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    address: {
        type: String,
        trim: true,
    },
    gstNo: {
        type: String,
        trim: true,
        unique: true,
        sparse: true, // allows multiple companies to have no GST number
    },
    phone: {
        type: String,
        trim: true,
    },
    logo: {
        type: String,
        trim: true,
        default: null,
    },
    workingHours: [
        {
            day: { type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], required: true },
            isActive: { type: Boolean, default: false },
            shift: {
                start: { type: String, default: '09:00' },
                end: { type: String, default: '17:00' }
            },
            break: {
                start: { type: String, default: '13:00' },
                end: { type: String, default: '14:00' }
            }
        }
    ],
    holidays: [
        {
            name: { type: String, required: true, trim: true },
            date: { type: Date, required: true }
        }
    ],
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Deleted'],
        default: 'Active',
    },
    members: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
            role: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Role',
                required: true,
            },
        },
    ],
    subscription: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subscription',
        default: null,
    },
    subscriptionExpiresAt: {
        type: Date,
        default: null,
    },
    subscriptionStatus: {
        type: String,
        enum: ['Active', 'Expired', 'Trial', 'None'],
        default: 'None',
    },
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);
