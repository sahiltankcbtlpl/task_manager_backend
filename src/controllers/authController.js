const User = require('../models/User');
const Company = require('../models/Company');
const Role = require('../models/Role');
const generateToken = require('../utils/generateToken');

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email }).populate({
            path: 'role'
        });

        if (user && (await user.matchPassword(password))) {

            generateToken(res, user._id);

            let userCompanies;
            if (user.role && user.role.name === 'Super Admin') {
                userCompanies = await Company.find({}).select('name _id logo');
            } else {
                userCompanies = await Company.find({ 'members.user': user._id }).select('name _id logo');
            }

            res.status(200).json({
                message: 'Login Successful',
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role ? user.role.name : null,
                permissions: user.role ? user.role.permissions : [],
                autosavePreference: user.autosavePreference,
                companies: userCompanies
            });
        } else {
            res.status(401);
            throw new Error('Invalid email or password');
        }
    } catch (error) {
        res.status(res.statusCode === 200 ? 500 : res.statusCode);
        res.json({ message: error.message });
    }
};

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Public
const logoutUser = (req, res) => {
    res.cookie('jwt', '', {
        httpOnly: true,
        expires: new Date(0),
    });
    res.status(200).json({ message: 'Logged out successfully' });
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate({
            path: 'role'
        });

        let userCompanies;
        if (user.role && user.role.name === 'Super Admin') {
            userCompanies = await Company.find({}).select('name _id logo');
        } else {
            userCompanies = await Company.find({ 'members.user': user._id }).select('name _id logo');
        }

        res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role ? user.role.name : null,
            permissions: user.role ? user.role.permissions : [],
            autosavePreference: user.autosavePreference,
            companies: userCompanies
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update current user profile
// @route   PUT /api/auth/me
// @access  Private
const updateMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;
            user.phone = req.body.phone || user.phone;

            if (req.body.password) {
                user.password = req.body.password;
            }

            if (req.body.autosavePreference !== undefined) {
                user.autosavePreference = req.body.autosavePreference === 'true' || req.body.autosavePreference === true;
            }

            const updatedUser = await user.save();
            await updatedUser.populate('role');

            res.status(200).json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                role: updatedUser.role ? updatedUser.role.name : null,
                permissions: updatedUser.role ? updatedUser.role.permissions : [],
                autosavePreference: updatedUser.autosavePreference,
                message: 'Profile updated successfully'
            });
        } else {
            res.status(404);
            throw new Error('User not found');
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Register a new user and company
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    try {
        const {
            companyName,
            companyEmail,
            companyAddress,
            gstNo,
            name,
            email,
            phone,
            password
        } = req.body;

        // 1. Validation
        if (!companyName || !companyEmail || !name || !email || !phone || !password) {
            res.status(400);
            throw new Error('Please provide all required fields');
        }

        if (password.length < 6) {
            res.status(400);
            throw new Error('Password must be at least 6 characters');
        }

        if (phone.length !== 10) {
            res.status(400);
            throw new Error('Phone number must be 10 digits');
        }

        // GST Validation (basic)
        if (gstNo && gstNo.length !== 15) {
            res.status(400);
            throw new Error('GST number must be 15 characters');
        }

        let user = await User.findOne({ email });

        if (user) {
            const isOwner = await Company.findOne({ owner: user._id });
            if (isOwner) {
                res.status(400);
                throw new Error('A user with this email is already a company owner');
            }
        }

        // 3. Check if company email already exists
        const companyExists = await Company.findOne({ email: companyEmail });
        if (companyExists) {
            res.status(400);
            throw new Error('A company with this email already exists');
        }

        // 4. Get or Create 'Company Owner' role
        const ownerPermissions = [
            'users-create', 'users-read', 'users-update', 'users-delete',
            'projects-create', 'projects-read', 'projects-update', 'projects-delete',
            'tasks-create', 'tasks-read', 'tasks-update', 'tasks-delete',
            'documents-create', 'documents-read', 'documents-update', 'documents-delete',
            'permissions-read',
            'MANAGE_ROLES'
        ];

        let ownerRole = await Role.findOne({ name: 'Company Owner' });
        if (!ownerRole) {
            ownerRole = await Role.create({
                name: 'Company Owner',
                permissions: ownerPermissions
            });
        } else {
            // Patch existing role — ensure MANAGE_ROLES is present (for older registrations)
            const missing = ownerPermissions.filter(p => !ownerRole.permissions.includes(p));
            if (missing.length > 0) {
                ownerRole.permissions = [...ownerRole.permissions, ...missing];
                await ownerRole.save();
            }
        }

        // 5. Create or Update user
        if (!user) {
            user = await User.create({
                name,
                email,
                phone,
                password,
                role: ownerRole._id
            });
        } else {
            // Upgrade role to Company Owner if they were previously just Staff
            user.role = ownerRole._id;
            await user.save();
        }

        // 6. Create Company
        const company = await Company.create({
            name: companyName,
            email: companyEmail,
            address: companyAddress,
            gstNo: gstNo && gstNo.trim() ? gstNo.trim() : undefined,
            owner: user._id,
            members: [{
                user: user._id,
                role: ownerRole._id
            }]
        });

        generateToken(res, user._id);

        const userCompanies = await Company.find({ 'members.user': user._id }).select('name _id logo');

        res.status(201).json({
            message: 'Registration Successful',
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: ownerRole.name,
                permissions: ownerRole.permissions,
                companies: userCompanies
            },
            company: {
                _id: company._id,
                name: company.name
            }
        });

    } catch (error) {
        // Friendly messages for MongoDB duplicate key errors
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern || {})[0];
            const friendlyField = {
                email: 'email address',
                gstNo: 'GST number',
                name: 'company name',
                phone: 'phone number',
            }[field] || field;
            res.status(400).json({ message: `A company with this ${friendlyField} already exists.` });
        } else {
            res.status(res.statusCode === 200 ? 500 : res.statusCode);
            res.json({ message: error.message });
        }
    }
};

module.exports = {
    loginUser,
    logoutUser,
    getMe,
    updateMe,
    registerUser,
};
