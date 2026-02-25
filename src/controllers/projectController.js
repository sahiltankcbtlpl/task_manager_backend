const Project = require('../models/Project');
const User = require('../models/User');
const { sendProjectAssignmentEmail } = require('../services/email.service');

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

        if (req.user.role.name !== 'Super Admin') {
            query.members = req.user._id;
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