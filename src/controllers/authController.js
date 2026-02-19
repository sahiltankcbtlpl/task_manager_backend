const User = require('../models/User');
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

            res.status(200).json({
                message: 'Login Successful',
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role ? user.role.name : null,
                permissions: user.role ? user.role.permissions : []
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

        res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role ? user.role.name : null,
            permissions: user.role ? user.role.permissions : []
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

            const updatedUser = await user.save();
            // Re-populate role for consistency in response
            await updatedUser.populate('role');

            res.status(200).json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                role: updatedUser.role ? updatedUser.role.name : null,
                permissions: updatedUser.role ? updatedUser.role.permissions : [],
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

module.exports = {
    loginUser,
    logoutUser,
    getMe,
    updateMe,
};
