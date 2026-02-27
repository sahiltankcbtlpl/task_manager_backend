const Project = require('../models/Project');
const User = require('../models/User');
const { sendProjectAssignmentEmail, sendMentionEmail } = require('../services/email.service');

// @desc    Create project
// @route   POST /api/projects
// @access  Private (Super Admin / Admin)
const createProject = async (req, res) => {
    try {
        const { title, description, members } = req.body;

        const project = await Project.create({
            title,
            description,
            members,
            createdBy: req.user._id,
        });

        // Send email to all assigned members
        if (members && members.length > 0) {
            const assignedUsers = await User.find({ _id: { $in: members } });
            assignedUsers.forEach(user => {
                sendProjectAssignmentEmail(
                    user.email,
                    user.name,
                    project.title,
                    project.description || 'No description provided.'
                );
            });
        }

        // Send email to mentioned users in description
        if (description) {
            const allUsers = await User.find({}).select('name email');
            const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const mentionedUsers = allUsers.filter(user => {
                const regex = new RegExp(`@${escapeRegex(user.name)}\\b`, 'i');
                return regex.test(description);
            });

            if (mentionedUsers.length > 0) {
                mentionedUsers.forEach(user => {
                    sendMentionEmail(user.email, user.name, project.title, project.description);
                });
            }
        }

        res.status(201).json(project);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get all projects
// @route   GET /api/projects
// @access  Private
const getProjects = async (req, res) => {
    try {
        let query = {};
        const { search } = req.query;

        // Base query for user access
        if (req.user.role.name !== 'Super Admin') {
            query.members = req.user._id;
        }

        // Search query logic
        if (search) {
            const searchRegex = new RegExp(search, 'i');

            // First find users that match the search term
            const matchingUsers = await User.find({ name: searchRegex }).select('_id');
            const matchingUserIds = matchingUsers.map(u => u._id);

            // Construct an $or query for title, description, and members
            const searchQuery = {
                $or: [
                    { title: searchRegex },
                    { description: searchRegex },
                    { members: { $in: matchingUserIds } }
                ]
            };

            // Combine with the base access query using $and to satisfy both conditions
            query = { $and: [query, searchQuery] };
        }

        const projects = await Project.find(query)
            .populate('members', 'name email')
            .populate('createdBy', 'name');

        res.json(projects);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get project by ID
// @route   GET /api/projects/:id
// @access  Private
const getProjectById = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('members', 'name email')
            .populate('createdBy', 'name');

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        if (req.user.role.name !== 'Super Admin') {
            const isMember = project.members.some(
                (member) => member._id.toString() === req.user._id.toString()
            );
            if (!isMember) {
                return res.status(403).json({ message: 'Not authorized to view this project' });
            }
        }

        res.json(project);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update project
// @route   PUT /api/projects/:id
// @access  Private (Super Admin / Admin)
const updateProject = async (req, res) => {
    try {
        const { title, description, members, status } = req.body;

        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const oldMembersStr = project.members.map(m => m.toString());
        const oldDescription = project.description;

        project.title = title ?? project.title;
        project.description = description ?? project.description;
        project.members = members ?? project.members;
        project.status = status ?? project.status;

        const updatedProject = await project.save();

        if (members) {
            const newMembers = members.filter(m => !oldMembersStr.includes(m.toString()));
            if (newMembers.length > 0) {
                const newlyAssignedUsers = await User.find({ _id: { $in: newMembers } });
                newlyAssignedUsers.forEach(user => {
                    sendProjectAssignmentEmail(
                        user.email,
                        user.name,
                        updatedProject.title,
                        updatedProject.description || 'No description provided.'
                    );
                });
            }
        }

        // Send email to newly mentioned users in description
        if (description && description !== oldDescription) {
            const allUsers = await User.find({}).select('name email');
            const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const mentionedUsers = allUsers.filter(user => {
                const regex = new RegExp(`@${escapeRegex(user.name)}\\b`, 'i');
                return regex.test(description);
            });

            if (mentionedUsers.length > 0) {
                const oldMentionedUsers = oldDescription
                    ? allUsers.filter(user => {
                        const regex = new RegExp(`@${escapeRegex(user.name)}\\b`, 'i');
                        return regex.test(oldDescription);
                    })
                    : [];

                const oldMentionedUsernames = oldMentionedUsers.map(u => u.name);

                mentionedUsers.forEach(user => {
                    if (!oldMentionedUsernames.includes(user.name)) {
                        sendMentionEmail(user.email, user.name, updatedProject.title, updatedProject.description);
                    }
                });
            }
        }

        res.json(updatedProject);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private (Super Admin)
const deleteProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }
        await project.deleteOne();
        res.json({ message: 'Project removed' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    deleteProject,
};