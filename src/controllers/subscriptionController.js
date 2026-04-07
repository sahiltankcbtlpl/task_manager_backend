const Subscription = require('../models/Subscription');
const Company = require('../models/Company');
const Project = require('../models/Project');
const Task = require('../models/Task');
const TaskStatus = require('../models/TaskStatus');
const Role = require('../models/Role');
const Document = require('../models/Document');
const { applySearch } = require('../utils/searchHelper');

// @desc    Create a new subscription plan
// @route   POST /api/subscriptions
// @access  Private (Super Admin)
const createSubscription = async (req, res) => {
    try {
        const { name, duration, price, features, status, isPopular, icon } = req.body;

        const subscriptionExists = await Subscription.findOne({ name, status: { $ne: 'Deleted' } });

        if (subscriptionExists) {
            return res.status(400).json({ message: 'Subscription plan with this name already exists' });
        }

        const subscription = await Subscription.create({
            name,
            duration,
            price,
            features,
            status: status || 'Active',
            isPopular: isPopular || false,
            icon: icon || 'FiBox',
        });

        res.status(201).json({
            message: 'Subscription plan created successfully',
            subscription
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get all subscription plans
// @route   GET /api/subscriptions
// @access  Private (Super Admin or Other depending on use case, but here Super Admin)
const getSubscriptions = async (req, res) => {
    try {
        const { search, status } = req.query;
        let query = { status: { $ne: 'Deleted' } };

        if (status) {
            query.status = status;
        }

        // Apply search if search parameter is provided
        query = applySearch(query, search, ['name']);

        const subscriptions = await Subscription.find(query);
        res.json(subscriptions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get subscription plan by ID
// @route   GET /api/subscriptions/:id
// @access  Private (Super Admin)
const getSubscriptionById = async (req, res) => {
    try {
        const subscription = await Subscription.findById(req.params.id);

        if (subscription && subscription.status !== 'Deleted') {
            res.json(subscription);
        } else {
            res.status(404).json({ message: 'Subscription plan not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update subscription plan
// @route   PUT /api/subscriptions/:id
// @access  Private (Super Admin)
const updateSubscription = async (req, res) => {
    try {
        const { name, duration, price, features, status, isPopular, icon } = req.body;
        const subscription = await Subscription.findById(req.params.id);

        if (subscription && subscription.status !== 'Deleted') {
            subscription.name = name || subscription.name;
            subscription.duration = duration || subscription.duration;
            subscription.price = price !== undefined ? price : subscription.price;
            subscription.features = features || subscription.features;
            subscription.status = status || subscription.status;
            subscription.isPopular = isPopular !== undefined ? isPopular : subscription.isPopular;
            subscription.icon = icon || subscription.icon;

            const updatedSubscription = await subscription.save();
            res.json({
                message: 'Subscription plan updated successfully',
                subscription: updatedSubscription
            });
        } else {
            res.status(404).json({ message: 'Subscription plan not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete subscription plan (Soft delete)
// @route   DELETE /api/subscriptions/:id
// @access  Private (Super Admin)
const deleteSubscription = async (req, res) => {
    try {
        const subscription = await Subscription.findById(req.params.id);

        if (subscription) {
            subscription.status = 'Deleted';
            await subscription.save();
            res.json({ message: 'Subscription plan removed successfully' });
        } else {
            res.status(404).json({ message: 'Subscription plan not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get current subscription usage for active company
// @route   GET /api/subscriptions/usage
// @access  Private
const getSubscriptionUsage = async (req, res) => {
    try {
        const companyId = req.headers['x-company-id'];
        if (!companyId) {
            return res.status(400).json({ message: 'Company ID required' });
        }

        const company = await Company.findById(companyId).populate('subscription');
        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }

        const subscription = company.subscription;
        const usage = [];

        if (subscription) {
            for (const feature of subscription.features) {
                let count = 0;
                const moduleName = feature.module.toLowerCase();

                if (moduleName === 'projects') {
                    count = await Project.countDocuments({ company: companyId });
                } else if (moduleName === 'tasks') {
                    count = await Task.countDocuments({ company: companyId, category: 'TASK', status: { $ne: 'deleted' } });
                } else if (moduleName === 'issues') {
                    count = await Task.countDocuments({ company: companyId, category: 'ISSUE', status: { $ne: 'deleted' } });
                } else if (moduleName === 'staff' || moduleName === 'users') {
                    count = company.members.length;
                } else if (moduleName === 'task status' || moduleName === 'taskstatus') {
                    const projectIds = await Project.find({ company: companyId }).select('_id');
                    count = await TaskStatus.countDocuments({ project: { $in: projectIds } });
                } else if (moduleName === 'roles') {
                    count = await Role.countDocuments({ company: companyId });
                } else if (moduleName === 'documents' || moduleName === 'document create') {
                    count = await Document.countDocuments({ company: companyId });
                }

                usage.push({
                    module: feature.module,
                    limit: feature.limit,
                    current: count
                });
            }
        }

        res.json({
            planName: subscription ? subscription.name : 'No Plan',
            status: company.subscriptionStatus,
            expiresAt: company.subscriptionExpiresAt,
            usage
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createSubscription,
    getSubscriptions,
    getSubscriptionById,
    updateSubscription,
    deleteSubscription,
    getSubscriptionUsage
};
