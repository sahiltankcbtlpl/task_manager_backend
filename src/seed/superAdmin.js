const mongoose = require('mongoose');
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const seedSuperAdmin = async () => {
    try {
        // 1. Seed Roles (Empty Permissions initially)

        // Super Admin
        let superAdminRole = await Role.findOne({ name: 'Super Admin' });
        if (!superAdminRole) {
            superAdminRole = await Role.create({
                name: 'Super Admin',
                permissions: [], // No default permissions
                status: 'Active'
            });
            console.log('Role created: Super Admin');
        }

        // Staff
        let staffRole = await Role.findOne({ name: 'Staff' });

        if (!staffRole) {
            staffRole = await Role.create({
                name: 'Staff',
                permissions: [], // Initialize with empty permissions
                status: 'Active'
            });
            console.log('Role created: Staff');
        }

        // 4. Seed Super Admin User
        const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
        const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

        if (!superAdminEmail || !superAdminPassword) {
            console.error('SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set in .env');
            return;
        }

        const superAdmin = await User.findOne({ email: superAdminEmail });

        if (!superAdmin) {
            await User.create({
                name: 'Sahil Tank',
                email: superAdminEmail,
                password: superAdminPassword, // Hashed by pre-save hook
                role: superAdminRole._id, // Assign Role ID
                phone: '0000000000'
            });
            console.log(`Super Admin created: ${superAdminEmail}`);
        } else {
            let userUpdated = false;

            // Update name if different
            if (superAdmin.name !== 'Sahil Tank') {
                superAdmin.name = 'Sahil Tank';
                userUpdated = true;
            }

            // Fix existing Super Admin role
            if (!superAdmin.role || !superAdmin.role.toString || superAdmin.role.toString() !== superAdminRole._id.toString()) {
                superAdmin.role = superAdminRole._id;
                userUpdated = true;
                console.log('Super Admin role updated to dynamic Role ID');
            }

            if (userUpdated) {
                await superAdmin.save();
                console.log('Super Admin details updated');
            } else {
                console.log('Super Admin already exists and is up to date');
            }
        }
    } catch (error) {
        console.error('Error seeding Super Admin:', error);
        process.exit(1);
    }
};

module.exports = seedSuperAdmin;
