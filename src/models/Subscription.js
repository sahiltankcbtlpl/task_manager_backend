const mongoose = require('mongoose');

const featureSchema = new mongoose.Schema({
    module: {
        type: String,
        required: true,
    },
    limit: {
        type: Number,
        required: true,
        default: 0,
    }
});

const subscriptionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    duration: {
        type: String,
        enum: ['Monthly', 'Quarterly', 'Yearly'],
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    features: [featureSchema],
    isPopular: {
        type: Boolean,
        default: false,
    },
    icon: {
        type: String,
        default: 'FiBox',
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Deleted'],
        default: 'Active',
    },
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
