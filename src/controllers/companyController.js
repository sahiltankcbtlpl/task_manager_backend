const Company = require('../models/Company');
const User = require('../models/User');

// @desc    Get all companies
// @route   GET /api/companies
// @access  Private (Super Admin)
const getCompanies = async (req, res) => {
    try {
        const companies = await Company.find({ status: { $ne: 'Deleted' } })
            .populate('owner', 'name email phone');
        res.status(200).json(companies);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get company by ID
// @route   GET /api/companies/:id
// @access  Private (Super Admin)
const getCompanyById = async (req, res) => {
    try {
        const company = await Company.findById(req.params.id)
            .populate('owner', 'name email phone');

        if (company && company.status !== 'Deleted') {
            res.status(200).json(company);
        } else {
            res.status(404);
            throw new Error('Company not found');
        }
    } catch (error) {
        res.status(res.statusCode === 200 ? 500 : res.statusCode);
        res.json({ message: error.message });
    }
};

// @desc    Update company
// @route   PUT /api/companies/:id
// @access  Private (Super Admin or Company Owner)
const updateCompany = async (req, res) => {
    try {
        const company = await Company.findById(req.params.id);

        if (company) {
            const isSuperAdmin = req.user.role && req.user.role.name === 'Super Admin';
            const isOwner = company.owner.toString() === req.user._id.toString();

            if (!isSuperAdmin && !isOwner) {
                res.status(403);
                throw new Error('Not authorized to update company settings');
            }

            company.name = req.body.name || company.name;
            company.gstNo = req.body.gstNo !== undefined ? req.body.gstNo : company.gstNo;
            company.email = req.body.email || company.email;
            company.phone = req.body.phone !== undefined ? req.body.phone : company.phone;
            company.address = req.body.address || company.address;
            company.status = req.body.status || company.status;

            if (req.file) {
                company.logo = `/uploads/companies/${req.file.filename}`;
            }

            if (req.body.workingHours) {
                try {
                    company.workingHours = JSON.parse(req.body.workingHours);
                } catch (e) {
                    console.error('Failed to parse workingHours', e);
                }
            }

            if (req.body.holidays) {
                try {
                    company.holidays = JSON.parse(req.body.holidays);
                } catch (e) {
                    console.error('Failed to parse holidays', e);
                }
            }

            const updatedCompany = await company.save();
            await updatedCompany.populate('owner', 'name email phone');

            res.status(200).json({
                message: 'Company updated successfully',
                company: updatedCompany
            });
        } else {
            res.status(404);
            throw new Error('Company not found');
        }
    } catch (error) {
        res.status(res.statusCode === 200 ? 500 : res.statusCode);
        res.json({ message: error.message });
    }
};

// @desc    Delete company (Soft delete)
// @route   DELETE /api/companies/:id
// @access  Private (Super Admin)
const deleteCompany = async (req, res) => {
    try {
        const company = await Company.findById(req.params.id);

        if (company) {
            company.status = 'Deleted';
            await company.save();
            res.status(200).json({ message: 'Company removed successfully' });
        } else {
            res.status(404);
            throw new Error('Company not found');
        }
    } catch (error) {
        res.status(res.statusCode === 200 ? 500 : res.statusCode);
        res.json({ message: error.message });
    }
};

module.exports = {
    getCompanies,
    getCompanyById,
    updateCompany,
    deleteCompany
};
