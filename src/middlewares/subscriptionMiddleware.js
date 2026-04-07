const Company = require('../models/Company');
const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const TaskStatus = require('../models/TaskStatus');
const Role = require('../models/Role');
const Document = require('../models/Document');

const checkSubscriptionLimit = (moduleName) => {
    return async (req, res, next) => {
        try {
            // Support dynamic module detection for tasks/issues
            let activeModule = moduleName;
            if (moduleName === 'TaskOrIssue') {
                activeModule = req.body.category === 'ISSUE' ? 'Issues' : 'Tasks';
            }

            // 1. Super Admin Bypass
            if (req.user && req.user.role && req.user.role.name === 'Super Admin') {
                return next();
            }

            if (!req.companyId) {
                return res.status(400).json({ message: 'Company context required' });
            }

            // 2. Fetch company with subscription populated
            const company = await Company.findById(req.companyId).populate('subscription');

            if (!company) {
                return res.status(404).json({ message: 'Company not found' });
            }

            // 3. No Plan Logic (Maintain existing unlimited behavior)
            if (!company.subscription) {
                return next();
            }

            const subscription = company.subscription;
            
            // 4. Check if subscription is active
            if (company.subscriptionStatus === 'Expired' || (company.subscriptionExpiresAt && new Date() > company.subscriptionExpiresAt)) {
                return res.status(403).json({ 
                    message: 'Your subscription has expired. Please renew to continue.',
                    expired: true 
                });
            }

            // 5. Find the limit for the specified module
            const feature = subscription.features.find(f => {
                const m = f.module.toLowerCase();
                const target = activeModule.toLowerCase();
                return m === target || 
                       (target === 'documents' && (m === 'document create' || m === 'document')) ||
                       (target === 'bulk upload' && (m === 'bulk_upload' || m === 'bulk-upload'));
            });
            
            if (!feature) {
                // If module is not in the plan, it's not allowed
                return res.status(403).json({
                    message: `Your current plan does not include the ${activeModule} feature. Please upgrade to access this.`,
                    limitReached: true,
                    module: activeModule,
                    current: 0,
                    limit: 0
                });
            }
            const limit = feature.limit;
            
            // Attach limit for specific use cases (like bulk upload record counts)
            if (activeModule.toLowerCase() === 'bulk upload') {
                req.bulkUploadLimit = limit;
            }

            // 7. Unlimited Bypass (-1 represents unlimited)
            if (limit === -1) {
                return next();
            }

            let currentCount = 0;

            // 6. Count current active records
            if (activeModule.toLowerCase() === 'projects') {
                currentCount = await Project.countDocuments({ company: req.companyId });
            } else if (activeModule.toLowerCase() === 'tasks') {
                currentCount = await Task.countDocuments({ 
                    company: req.companyId, 
                    category: 'TASK',
                    status: { $ne: 'deleted' } 
                });
            } else if (activeModule.toLowerCase() === 'issues') {
                currentCount = await Task.countDocuments({ 
                    company: req.companyId, 
                    category: 'ISSUE',
                    status: { $ne: 'deleted' } 
                });
            } else if (activeModule.toLowerCase() === 'staff' || activeModule.toLowerCase() === 'users') {
                currentCount = company.members.length;
            } else if (activeModule.toLowerCase() === 'task status' || activeModule.toLowerCase() === 'taskstatus') {
                // Count status across all projects of the company
                const projectIds = await Project.find({ company: req.companyId }).select('_id');
                currentCount = await TaskStatus.countDocuments({ project: { $in: projectIds } });
            } else if (activeModule.toLowerCase() === 'roles') {
                // Count custom roles created for this company
                currentCount = await Role.countDocuments({ company: req.companyId });
            } else if (activeModule.toLowerCase() === 'documents') {
                currentCount = await Document.countDocuments({ company: req.companyId });
            }

            // 7. Enforcement
            if (currentCount >= limit) {
                return res.status(403).json({
                    message: `Subscription limit reached for ${activeModule}. Current: ${currentCount}, Limit: ${limit}.`,
                    limitReached: true,
                    module: activeModule,
                    current: currentCount,
                    limit: limit
                });
            }

            next();
        } catch (error) {
            console.error('Subscription Check Error:', error);
            res.status(500).json({ message: 'Error checking subscription limits' });
        }
    };
};

module.exports = { checkSubscriptionLimit };
