const Permission = require('../models/Permission');

// @desc    Create a new permission
// @route   POST /api/permissions
// @access  Private (Super Admin)
const createPermission = async (req, res) => {
    try {
        let { name, value, status } = req.body;

        // If value is not provided, use name. Format it: lowercase, replace spaces with underscores
        const valueToFormat = value || name;
        const formattedValue = valueToFormat.trim().toLowerCase().replace(/\s+/g, '_');

        const permissionExists = await Permission.findOne({ value: formattedValue });

        if (permissionExists) {
            res.status(400);
            throw new Error('Permission already exists');
        }

        const permission = await Permission.create({
            name,
            value: formattedValue,
            status: status ? status.toLowerCase() : 'active',
        });

        res.status(201).json({
            message: 'Permission created successfully',
            permission
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get all permissions
// @route   GET /api/permissions
// @access  Private (Super Admin)
const getPermissions = async (req, res) => {
    try {
        const permissions = await Permission.find({ status: { $ne: 'deleted' } });
        res.json(permissions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update permission
// @route   PUT /api/permissions/:id
// @access  Private (Super Admin)
const updatePermission = async (req, res) => {
    try {
        const { name, value, status } = req.body;
        const permission = await Permission.findById(req.params.id);

        if (permission) {
            permission.name = name || permission.name;

            if (value) {
                permission.value = value.trim().toLowerCase().replace(/\s+/g, '_');
            } else if (!permission.value && name) {
                // Fallback if value invalid, though it should exist
                permission.value = name.trim().toLowerCase().replace(/\s+/g, '_');
            }

            if (status) {
                permission.status = status.toLowerCase();
            }

            const updatedPermission = await permission.save();
            res.json({
                message: 'Permission updated',
                permission: updatedPermission
            });
        } else {
            res.status(404);
            throw new Error('Permission not found');
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete permission (Soft delete)
// @route   DELETE /api/permissions/:id
// @access  Private (Super Admin)
const deletePermission = async (req, res) => {
    try {
        const permission = await Permission.findById(req.params.id);

        if (permission) {
            // Soft delete by setting status to deleted
            permission.status = 'deleted';
            await permission.save();
            res.json({ message: 'Permission removed' });
        } else {
            res.status(404);
            throw new Error('Permission not found');
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    createPermission,
    getPermissions,
    updatePermission,
    deletePermission
};
