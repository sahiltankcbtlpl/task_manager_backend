const User = require('../models/User');
const Role = require('../models/Role'); // Import Role model
const generatePassword = require('../utils/generatePassword');
const sendMail = require('../utils/sendMail');
const ROLES = require('../config/roles');

// @desc    Create a new staff user
// @route   POST /api/users
// @access  Private (Admin/Manager)
const createStaff = async (req, res) => {
    try {
        const { name, email, phone, role } = req.body;

        const [userExists, roleDoc] = await Promise.all([
            User.findOne({ email }),
            (!role || (typeof role === 'string' && !role.match(/^[0-9a-fA-F]{24}$/)))
                ? Role.findOne({ name: role || 'Staff' })
                : Role.findById(role)
        ]);

        if (userExists) {
            res.status(400);
            throw new Error('User already exists');
        }

        if (!roleDoc) {
            res.status(400);
            throw new Error(`Role not found`);
        }

        const roleId = roleDoc._id;
        const roleNameForEmail = roleDoc.name;

        const password = generatePassword();

        const user = await User.create({
            name,
            email,
            phone,
            password, // Will be hashed by pre-save hook
            role: roleId
        });

        if (user) {
            // Send email with credentials
            const message = `
          <h1>Welcome to Task Manager</h1>
          <p>Your account has been created.</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Password:</strong> ${password}</p>
          <p><strong>Role:</strong> ${roleNameForEmail}</p>
          <p>Please login and change your password.</p>
        `;

            try {
                sendMail({
                    email: user.email,
                    subject: 'Task Manager Account Created',
                    html: message,
                });
            } catch (error) {
                console.error(`Email send failed: ${error.message}`);
                // Don't fail the request if email fails, but log it
            }

            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                message: 'User created and email sent',
            });
        } else {
            res.status(400);
            throw new Error('Invalid user data');
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const { applySearch } = require('../utils/searchHelper');

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin/Manager)
const getUsers = async (req, res) => {
    try {
        const { role, search } = req.query;
        let query = {};

        if (role) {
            query.role = role;
        }

        // Apply search if search parameter is provided
        query = applySearch(query, search, ['name', 'email']);

        const users = await User.find(query).populate('role', 'name');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private (Admin/Manager)
const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).populate('role', 'name');

        if (user) {
            res.json(user);
        } else {
            res.status(404);
            throw new Error('User not found');
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin/Manager)
const updateUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;
            user.phone = req.body.phone || user.phone;

            // Update role if provided
            if (req.body.role) {
                let roleId = req.body.role;
                // If role is a name string or empty, lookup the Role ID
                if (typeof roleId === 'string' && !roleId.match(/^[0-9a-fA-F]{24}$/)) {
                    const roleDoc = await Role.findOne({ name: roleId });
                    if (!roleDoc) {
                        res.status(400);
                        throw new Error(`Role '${roleId}' not found`);
                    }
                    roleId = roleDoc._id;
                }
                user.role = roleId;
            }

            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                message: 'User updated successfully'
            });
        } else {
            res.status(404);
            throw new Error('User not found');
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin/Manager)
const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            await user.deleteOne();
            res.json({ message: 'User removed' });
        } else {
            res.status(404);
            throw new Error('User not found');
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    createStaff,
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
};
