const Role = require('../models/Role');

// @desc    Create a new role
// @route   POST /api/roles
// @access  Private (Super Admin)
const createRole = async (req, res) => {
    try {
        const { name, permissions, status } = req.body;

        const roleExists = await Role.findOne({ name });

        if (roleExists) {
            res.status(400);
            throw new Error('Role already exists');
        }

        const role = await Role.create({
            name,
            permissions,
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
        let query = { status: { $ne: 'Deleted' } };

        // Apply search if search parameter is provided
        query = applySearch(query, search, ['name']);

        const roles = await Role.find(query)
            .populate('permissions', 'name');
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
        const role = await Role.findById(req.params.id)
            .populate('permissions', 'name');

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
            const populatedRole = await updatedRole.populate('permissions', 'name');

            res.json({
                message: 'Role updated',
                role: populatedRole
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
