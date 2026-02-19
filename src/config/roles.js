const ROLES = {
    SUPER_ADMIN: {
        name: 'Super Admin',
        permissions: [
            'CREATE_USER',
            'READ_USER',
            'UPDATE_USER',
            'DELETE_USER',
            'MANAGE_ROLES',
            'MANAGE_TASKS'
        ]
    },
    STAFF: {
        name: 'Staff',
        permissions: [
            'READ_USER',
            'MANAGE_TASKS'
        ]
    }
};

module.exports = ROLES;
