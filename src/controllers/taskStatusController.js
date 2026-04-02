const TaskStatus = require('../models/TaskStatus');

// @desc    Create a new task status
// @route   POST /api/task-status
// @access  Private (Manage Tasks)
const createTaskStatus = async (req, res) => {
    try {
        const { name, status, project } = req.body;

        if (!project) {
            res.status(400);
            throw new Error('Project ID is required');
        }

        const statusExists = await TaskStatus.findOne({ 
            name, 
            project,
            status: { $ne: 'deleted' }
        });

        if (statusExists) {
            res.status(400);
            throw new Error('Task status with this name already exists in this project');
        }

        const taskStatus = await TaskStatus.create({
            name,
            project,
            status
        });

        res.status(201).json(taskStatus);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Task status with this name already exists in this project' });
        }
        res.status(400).json({ message: error.message });
    }
};

const { applySearch } = require('../utils/searchHelper');

// @desc    Get all task status
// @route   GET /api/task-status
// @access  Private (Manage Tasks)
const getTaskstatus = async (req, res) => {
    try {
        const { search, project } = req.query;
        let query = { 
            status: { $ne: 'deleted' }
        };

        if (project) {
            query.project = project;
        }

        // Apply search if search parameter is provided
        query = applySearch(query, search, ['name']);

        const statuses = await TaskStatus.find(query);
        res.json(statuses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get task status by ID
// @route   GET /api/task-status/:id
// @access  Private (Manage Tasks)
const getTaskStatusById = async (req, res) => {
    try {
        const taskStatus = await TaskStatus.findOne({
            _id: req.params.id
        });

        if (taskStatus) {
            res.json(taskStatus);
        } else {
            res.status(404);
            throw new Error('Task status not found');
        }
    } catch (error) {
        res.status(404).json({ message: 'Task status not found' });
    }
};

// @desc    Update task status
// @route   PUT /api/task-status/:id
// @access  Private (Manage Tasks)
const updateTaskStatus = async (req, res) => {
    try {
        const { name, status } = req.body;
        const taskStatus = await TaskStatus.findOne({
            _id: req.params.id
        });

        if (taskStatus) {
            if (name) taskStatus.name = name;
            if (status !== undefined) taskStatus.status = status;

            const updatedStatus = await taskStatus.save();
            res.json(updatedStatus);
        } else {
            res.status(404);
            throw new Error('Task status not found');
        }
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Task status with this name already exists in this project' });
        }
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete task status (Soft Delete)
// @route   DELETE /api/task-status/:id
// @access  Private (Manage Tasks)
const deleteTaskStatus = async (req, res) => {
    try {
        const taskStatus = await TaskStatus.findOne({
            _id: req.params.id
        });

        if (taskStatus) {
            taskStatus.status = 'deleted';
            await taskStatus.save();
            res.json({ message: 'Task status removed' });
        } else {
            res.status(404);
            throw new Error('Task status not found');
        }
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Task status with this name already exists in this project' });
        }
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    createTaskStatus,
    getTaskstatus,
    getTaskStatusById,
    updateTaskStatus,
    deleteTaskStatus
};
