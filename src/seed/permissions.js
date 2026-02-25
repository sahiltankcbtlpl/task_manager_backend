const mongoose = require('mongoose');
const Permission = require('../models/Permission');
require('dotenv').config();

const modules = ['user', 'role', 'permission', 'task', 'staff', 'task_status', 'project']; // Add 'staff', 'task', and 'project' as they appear in user's UI/context
const actions = ['view', 'create', 'update', 'delete', 'manage']; // 'manage' fits 'All' or specific overrides? The UI has 'Manage'. 
// Wait, the UI has columns: All, View, Create, Update, Delete, Manage. 
// "All" is usually a UI helper. "Manage" might be a specific permission or just a catch-all.
// The screenshot shows "Manage Slot", "Game", "Role", "Gamezone Setup", etc. 
// The columns are "READ", "CREATE", "UPDATE", "DELETE". 
// The existing `RoleForm` code has: `['view', 'create', 'update', 'delete', 'manage']`.
// I should stick to what the UI expects or what I want to support. 
// The user request says "show the all permission with crud checkbox". 
// I will stick to `view`, `create`, `update`, `delete`. I'll add `manage` just in case, or maybe map it.
// Actually, `manage` often implies everything.
// Let's stick to the requested 4 CRUD + maybe `manage` if valid.

const seedPermissions = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected for Seeding Permissions');

        const permissionsToCreate = [];

        modules.forEach(module => {
            actions.forEach(action => {
                let formattedModule = module;
                // Add pluralization for routes that expect it (user -> users, role -> roles, task -> tasks)
                if (['user', 'role', 'task', 'permission', 'project'].includes(module)) {
                    formattedModule = module + 's';
                }

                // Map actions if needed (view -> read)
                let formattedAction = action;
                if (action === 'view') formattedAction = 'read';

                permissionsToCreate.push({
                    name: `${action.charAt(0).toUpperCase() + action.slice(1)} ${module.charAt(0).toUpperCase() + module.slice(1)}`,
                    value: `${formattedModule}-${formattedAction}`, // e.g., users-read
                    status: 'active'
                });
            });
        });

        for (const perm of permissionsToCreate) {
            const exists = await Permission.findOne({ value: perm.value });
            if (!exists) {
                await Permission.create(perm);
                console.log(`Created permission: ${perm.value}`);
            } else {
                console.log(`Permission already exists: ${perm.value}`);
            }
        }

        console.log('Permission seeding complete');
        process.exit();
    } catch (error) {
        console.error('Error seeding permissions:', error);
        process.exit(1);
    }
};

seedPermissions();
