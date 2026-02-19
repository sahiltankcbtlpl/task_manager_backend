const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    // 1️⃣ Get token from cookie
    if (req.cookies?.jwt) {
        token = req.cookies.jwt;
    }
    // 2️⃣ Or from Authorization header
    else if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({
            message: 'Not authorized, no token'
        });
    }

    try {
        // 3️⃣ Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 4️⃣ Get user + role
        const user = await User.findById(decoded.id)
            .select('-password')
            .populate('role');

        if (!user) {
            return res.status(401).json({
                message: 'Not authorized, user not found'
            });
        }

        // 5️⃣ Attach user to request
        req.user = user;

        next();
    } catch (error) {
        console.error('Token verification failed:', error.message);
        return res.status(401).json({
            message: 'Not authorized, token failed'
        });
    }
};

module.exports = { protect };
