const User = require('../models/User');
const Role = require('../models/Role');
const Company = require('../models/Company');
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
        let user;
        let userCreated = false;

        if (!userExists) {
            user = await User.create({
                name,
                email,
                phone,
                password, // Will be hashed by pre-save hook
                role: roleId
            });
            userCreated = true;
        } else {
            user = userExists;
        }

        // Add user to company members
        const company = await Company.findById(req.companyId);

        if (!company) {
            res.status(404);
            throw new Error('Company not found');
        }

        const isMember = company.members.find(m => m.user.toString() === user._id.toString());

        if (isMember) {
            res.status(400);
            throw new Error('User is already a member of this company');
        }

        company.members.push({
            user: user._id,
            role: roleId
        });
        await company.save();

        if (user) {
            // Send email with credentials
            const baseUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:3000';
            const loginLink = `${baseUrl}/login`;

            const generateEmailTemplate = require('../utils/emailTemplate');
            const htmlMessage = generateEmailTemplate(
                'Welcome to Task Manager',
                `
                    <h3>Welcome to Task Manager</h3>
                    <p>Your account has been created successfully. Here are your login credentials:</p>
                    <div class="highlight-box">
                        <p style="margin: 0; margin-bottom: 8px;"><strong>Email:</strong> ${email}</p>
                        <p style="margin: 0; margin-bottom: 8px;"><strong>Password:</strong> ${password}</p>
                        <p style="margin: 0;"><strong>Role:</strong> ${roleNameForEmail}</p>
                    </div>
                    <p>Please login and change your password immediately.</p>
                    <a href="${loginLink}" class="action-button" style="color: #ffffff;">Log In to Task Manager</a>
                `
            );

            try {
                sendMail({
                    email: user.email,
                    subject: 'Task Manager Account Created',
                    html: htmlMessage,
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

        // Filter users by company membership
        const company = await Company.findById(req.companyId).populate('members.user').populate('members.role');

        if (!company) {
            res.status(404);
            throw new Error('Company not found');
        }

        const memberIds = company.members.map(m => m.user._id);

        query._id = { $in: memberIds };

        if (role) {
            query.role = role;
        }

        // Apply search if search parameter is provided
        query = applySearch(query, search, ['name', 'email']);

        const users = await User.find(query).populate('role', 'name');

        const usersWithCompanyRole = users.map(u => {
            const memberInfo = company.members.find(m => m.user._id.toString() === u._id.toString());
            return {
                ...u.toObject(),
                companyRole: memberInfo && memberInfo.role ? memberInfo.role.name : null
            };
        });

        res.json(usersWithCompanyRole);
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
