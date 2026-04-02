// Access is determined by permissions stored in DB on the role

const checkPermission = (requiredPermission) => {
    return (req, res, next) => {

        // 1️⃣ User & role check
        if (!req.user || !req.user.role) {
            return res.status(401).json({
                message: 'Not authorized, role not found on user'
            });
        }

        // 2️⃣ Super Admin bypass
        if (req.user.role.name === 'Super Admin') {
            return next();
        }

        // 3️⃣ MANAGE_ROLES bypass — users with this permission can manage roles/permissions
        const rolePermissionsEarly = req.user.role.permissions;
        if (Array.isArray(rolePermissionsEarly) && rolePermissionsEarly.includes('MANAGE_ROLES')) {
            return next();
        }

        // 3️⃣ Permissions array check
        // console.log(req.user.role.permissions);
        const rolePermissions = req.user.role.permissions;

        if (!Array.isArray(rolePermissions)) {
            return res.status(403).json({
                message: 'Not authorized, no permissions found'
            });
        }

        // 4️⃣ EXACT string match (matches DB like "users-delete")
        const hasPermission = rolePermissions.includes(requiredPermission);

        // console.log(hasPermission);
        if (!hasPermission) {
            return res.status(403).json({
                message: `Not authorized, missing permission: ${requiredPermission}`
            });
        }

        next();
    };
};

module.exports = { checkPermission };
