const Role = require('../models/Role');

// @desc    Create a new role
// @route   POST /api/roles
// @access  Private (Super Admin)
const createRole = async (req, res) => {
    try {
        const { name, permissions, status } = req.body;
        const companyId = req.companyId;

        if (!companyId) {
            return res.status(400).json({ message: 'Company ID is required' });
        }

        const roleExists = await Role.findOne({ name, company: companyId });

        if (roleExists) {
            return res.status(400).json({ message: 'Role already exists for this company' });
        }

        const role = await Role.create({
            name,
            permissions,
            company: companyId,
            status: status || 'Active',
        });

        res.status(201).json({
            message: 'Role created successfully',
            role
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const { applySearch } = require('../utils/searchHelper');

// @desc    Get all roles
// @route   GET /api/roles
// @access  Private (Super Admin)
const getRoles = async (req, res) => {
    try {
        const { search } = req.query;
        const companyId = req.companyId;

        // Fetch roles that are system-wide (null) or specific to this company
        let query = { 
            status: { $ne: 'Deleted' },
            $or: [
                { company: companyId },
                { company: null }
            ]
        };

        // Filter out 'Super Admin' and 'Company Owner' for 'Company Owner' users
        if (req.user && req.user.role && req.user.role.name === 'Company Owner') {
            query.name = { $nin: ['Super Admin', 'Company Owner'] };
        }

        // Apply search if search parameter is provided
        query = applySearch(query, search, ['name']);

        const roles = await Role.find(query);
        res.json(roles);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get role by ID
// @route   GET /api/roles/:id
// @access  Private (Super Admin)
const getRoleById = async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);

        if (role) {
            res.json(role);
        } else {
            res.status(404);
            throw new Error('Role not found');
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update role
// @route   PUT /api/roles/:id
// @access  Private (Super Admin)
const updateRole = async (req, res) => {
    try {
        const { name, permissions, status } = req.body;
        const role = await Role.findById(req.params.id);

        if (role) {
            role.name = name || role.name;
            role.permissions = permissions || role.permissions;
            role.status = status || role.status;

            const updatedRole = await role.save();
            res.json({
                message: 'Role updated',
                role: updatedRole
            });
        } else {
            res.status(404);
            throw new Error('Role not found');
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete role (Soft delete)
// @route   DELETE /api/roles/:id
// @access  Private (Super Admin)
const deleteRole = async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);

        if (role) {
            role.status = 'Deleted';
            await role.save();
            res.json({ message: 'Role removed' });
        } else {
            res.status(404);
            throw new Error('Role not found');
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    createRole,
    getRoles,
    getRoleById,
    updateRole,
    deleteRole
};
