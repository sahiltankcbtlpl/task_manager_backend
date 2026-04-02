const Company = require('../models/Company');
const mongoose = require('mongoose');

const checkCompanyAccess = async (req, res, next) => {
    try {
        const companyId = req.headers['x-company-id'] || req.query.companyId || req.body.companyId;

        if (!companyId) {
            return res.status(400).json({ message: 'Company ID is required in headers (x-company-id)' });
        }

        // Validate if companyId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(companyId)) {
            return res.status(400).json({ message: 'Invalid Company ID format' });
        }

        const company = await Company.findById(companyId).populate('members.role');

        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }

        // Check if user is a member of the company
        const member = company.members.find(
            (m) => m.user.toString() === req.user._id.toString()
        );

        if (!member) {
            // Super Admin bypass?
            if (req.user.role && req.user.role.name === 'Super Admin') {
                req.companyId = new mongoose.Types.ObjectId(companyId);
                req.role = 'owner'; // Give super admin owner status for any company
                return next();
            }
            return res.status(403).json({ message: 'You are not a member of this company' });
        }

        // Attach company info to request
        req.companyId = new mongoose.Types.ObjectId(companyId);
        req.role = member.role ? member.role.name : 'Staff';

        next();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { checkCompanyAccess };
