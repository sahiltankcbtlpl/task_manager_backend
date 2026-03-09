const Task = require('../models/Task');
const TaskStatus = require('../models/TaskStatus');
const Project = require('../models/Project');
const xlsx = require('xlsx');
const { sendTaskAssignmentEmail, sendMentionEmail } = require('../services/email.service');
const User = require('../models/User'); // Import User model
const { isUserProjectMember } = require('../utils/projectHelper');

// @desc    Create a new task
// @route   POST /api/tasks
// @access  Private (Manage Tasks)
const createTask = async (req, res) => {
    try {
        let { name, description, taskStatus, status, assignee, project, category } = req.body;

        if (!project) {
            res.status(400);
            throw new Error('Project is required');
        }

        const isMember = await isUserProjectMember(project, assignee);
        if (assignee && !isMember) {
            res.status(400);
            throw new Error('Assignee must be a member of the project');
        }

        // Check for duplicate title
        const existingTask = await Task.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') },
            project,
            category
        });

        if (existingTask) {
            res.status(400);
            throw new Error(`A ${category.toLowerCase()} with this title already exists in the project`);
        }

        // If no taskStatus provided, find the first active status
        if (!taskStatus) {
            const defaultStatus = await TaskStatus.findOne({ status: 'active' });
            if (!defaultStatus) {
                res.status(400);
                throw new Error('No active task status found. Please create one first.');
            }
            taskStatus = defaultStatus._id;
        }

        const taskData = {
            name,
            description,
            taskStatus,
            status,
            assignee,
            project,
            category
        };

        if (req.files) {
            if (req.files.attachments) {
                taskData.attachments = req.files.attachments.map(file => ({
                    filename: file.filename,
                    path: file.path,
                    mimetype: file.mimetype,
                    size: file.size
                }));
            }
            if (req.files.videoAttachments) {
                taskData.videoAttachments = req.files.videoAttachments.map(file => ({
                    filename: file.filename,
                    path: file.path,
                    mimetype: file.mimetype,
                    size: file.size
                }));
            }
        }

        const task = await Task.create(taskData);

        // Populate everything for immediate feedback
        const populatedTask = await task.populate([
            { path: 'taskStatus', select: 'name status' },
            { path: 'status', select: 'name value' }, // Permission
            { path: 'assignee', select: 'name email' },
            { path: 'project', select: 'title' },
            { path: 'mentionedUsers', select: 'name email' }
        ]);

        // Parse mentions and send emails asynchronously
        if (description) {
            const projectDoc = await Project.findById(project).select('members').lean();
            const projectMembersList = await User.find({ _id: { $in: projectDoc.members } }).select('name email');
            const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const mentionedUsersList = projectMembersList.filter(user => {
                const regex = new RegExp(`@${escapeRegex(user.name)}\\b`, 'i');
                return regex.test(description);
            });

            if (mentionedUsersList.length > 0) {
                task.mentionedUsers = mentionedUsersList.map(u => u._id);
                await task.save();

                const baseUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:3000';
                const loginLink = `${baseUrl}/login`;

                mentionedUsersList.forEach(user => {
                    sendMentionEmail(user.email, user.name, populatedTask.name, populatedTask.description, loginLink);
                });
            }
        }

        // Send email notification to assignee
        if (assignee && populatedTask.assignee) {
            const assignedBy = req.user.name; // Assuming req.user is populated by auth middleware

            // Collect all attachments to send in the email
            const emailAttachments = [
                ...(populatedTask.attachments || []),
                ...(populatedTask.videoAttachments || [])
            ];

            const baseUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:3000';
            const loginLink = `${baseUrl}/login`;

            sendTaskAssignmentEmail(
                populatedTask.assignee.email,
                populatedTask.name,
                populatedTask.assignee.name,
                assignedBy,
                emailAttachments,
                loginLink,
                populatedTask.category
            );
        }

        res.status(201).json(populatedTask);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const { applySearch } = require('../utils/searchHelper');

// @desc    Get all tasks
// @route   GET /api/tasks
// @access  Private (Manage Tasks/Read Tasks)
const getTasks = async (req, res) => {
    try {
        let query = {};

        const { status, assignee, search, project, category } = req.query;

        // If not Super Admin, show only assigned tasks
        if (req.user.role.name !== 'Super Admin') {
            query.assignee = req.user._id;
        } else if (assignee) {
            // Only Super Admin can filter by assignee
            query.assignee = assignee;
        }

        if (status) query.taskStatus = status;
        if (project) query.project = project;
        if (category) query.category = category;

        // Apply search if search parameter is provided
        query = applySearch(query, search, ['name', 'description']);

        // console.log('getTasks query:', query); // DEBUG
        const tasks = await Task.find(query)
            .sort({ createdAt: -1 })
            .populate('taskStatus', 'name status')
            .populate('status', 'name value')
            .populate('assignee', 'name email')
            .populate({
                path: 'project',
                select: 'title members',
                populate: {
                    path: 'members',
                    select: 'name email role'
                }
            })
            .populate('mentionedUsers', 'name email');

        // console.log(`Found ${tasks.length} tasks for user ${req.user.name} (${req.user.role.name})`); // DEBUG
        if (tasks.length > 0) {
            // console.log('Sample task attachment:', tasks[0].attachment); // DEBUG
        }
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get task by ID
// @route   GET /api/tasks/:id
// @access  Private (Manage Tasks/Read Tasks)
const getTaskById = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id)
            .populate('taskStatus', 'name status')
            .populate('status', 'name value')
            .populate('assignee', 'name email')
            .populate('project', 'title')
            .populate('mentionedUsers', 'name email');

        if (task) {
            res.json(task);
        } else {
            res.status(404);
            throw new Error('Task not found');
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private (Manage Tasks)
const updateTask = async (req, res) => {
    try {
        const { name, description, taskStatus, status, assignee, project, category } = req.body;
        const task = await Task.findById(req.params.id);

        if (task) {
            const oldAssignee = task.assignee;
            const oldDescription = task.description;

            const currentProjectId = project || task.project;
            const isMember = await isUserProjectMember(currentProjectId, assignee);

            if (assignee && !isMember) {
                res.status(400);
                throw new Error('Assignee must be a member of the project');
            }

            if (name && name.toLowerCase() !== task.name.toLowerCase()) {
                const existingTask = await Task.findOne({
                    name: { $regex: new RegExp(`^${name}$`, 'i') },
                    project: currentProjectId,
                    category: category || task.category
                });
                if (existingTask) {
                    res.status(400);
                    throw new Error(`A ${(category || task.category).toLowerCase()} with this title already exists in the project`);
                }
            }

            task.name = name ?? task.name;
            task.description = description ?? task.description;
            task.taskStatus = taskStatus ?? task.taskStatus;
            task.status = status ?? task.status;
            task.assignee = assignee ?? task.assignee;
            if (project) task.project = project;
            if (category) task.category = category;

            if (req.body.removedAttachments) {
                try {
                    const removedIds = JSON.parse(req.body.removedAttachments);
                    task.attachments = task.attachments.filter(att => !removedIds.includes(att._id.toString()));
                } catch (e) {
                    console.error('Failed to parse removedAttachments', e);
                }
            }

            if (req.body.removedVideoAttachments) {
                try {
                    const removedIds = JSON.parse(req.body.removedVideoAttachments);
                    task.videoAttachments = task.videoAttachments.filter(att => !removedIds.includes(att._id.toString()));
                } catch (e) {
                    console.error('Failed to parse removedVideoAttachments', e);
                }
            }

            if (req.files) {
                if (req.files.attachments) {
                    const newAtt = req.files.attachments.map(file => ({
                        filename: file.filename,
                        path: file.path,
                        mimetype: file.mimetype,
                        size: file.size
                    }));
                    task.attachments = [...(task.attachments || []), ...newAtt];
                }
                if (req.files.videoAttachments) {
                    const newVid = req.files.videoAttachments.map(file => ({
                        filename: file.filename,
                        path: file.path,
                        mimetype: file.mimetype,
                        size: file.size
                    }));
                    task.videoAttachments = [...(task.videoAttachments || []), ...newVid];
                }
            }

            // Legacy attachment removal support
            if (req.body.removeLegacyAttachment === 'true') {
                task.attachment = undefined;
            }

            const updatedTask = await task.save();

            // Send email to newly mentioned users in description
            if (description && description !== oldDescription) {
                const projectDoc = await Project.findById(currentProjectId).select('members').lean();
                const projectMembersList = await User.find({ _id: { $in: projectDoc.members } }).select('name email');
                const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const mentionedUsersList = projectMembersList.filter(user => {
                    const regex = new RegExp(`@${escapeRegex(user.name)}\\b`, 'i');
                    return regex.test(description);
                });

                if (mentionedUsersList.length > 0) {
                    updatedTask.mentionedUsers = mentionedUsersList.map(u => u._id);
                    await updatedTask.save();

                    const oldMentionedUsers = oldDescription
                        ? projectMembersList.filter(user => {
                            const regex = new RegExp(`@${escapeRegex(user.name)}\\b`, 'i');
                            return regex.test(oldDescription);
                        })
                        : [];

                    const oldMentionedUsernames = oldMentionedUsers.map(u => u.name);

                    const baseUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:3000';
                    const loginLink = `${baseUrl}/login`;

                    mentionedUsersList.forEach(user => {
                        if (!oldMentionedUsernames.includes(user.name)) {
                            sendMentionEmail(user.email, user.name, updatedTask.name, updatedTask.description, loginLink);
                        }
                    });
                }
            }

            const populatedTask = await updatedTask.populate([
                { path: 'taskStatus', select: 'name status' },
                { path: 'status', select: 'name value' },
                { path: 'assignee', select: 'name email' },
                { path: 'project', select: 'title' },
                { path: 'mentionedUsers', select: 'name email' }
            ]);

            // Send email if assignee changed and is not the same as before
            // Also assigner should be Super Admin technically, but here any update by authorized user triggers it.
            // Requirement says "when superadmin assign task".
            // Since this route is protected, we can assume authorized user.
            if (assignee && assignee !== oldAssignee?.toString() && populatedTask.assignee) {
                const assignedBy = req.user.name;

                // Collect all attachments to send in the email
                const emailAttachments = [
                    ...(populatedTask.attachments || []),
                    ...(populatedTask.videoAttachments || [])
                ];

                const baseUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:3000';
                const loginLink = `${baseUrl}/login`;

                sendTaskAssignmentEmail(
                    populatedTask.assignee.email,
                    populatedTask.name,
                    populatedTask.assignee.name,
                    assignedBy,
                    emailAttachments,
                    loginLink,
                    populatedTask.category
                );
            }

            res.json(populatedTask);
        } else {
            res.status(404);
            throw new Error('Task not found');
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private (Manage Tasks)
const deleteTask = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);

        if (task) {
            await task.deleteOne();
            res.json({ message: 'Task removed' });
        } else {
            res.status(404);
            throw new Error('Task not found');
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Bulk upload tasks/issues from Excel
// @route   POST /api/tasks/bulk-upload
// @access  Private (Manage Tasks)
const bulkUploadTasks = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Excel file is required' });
        }

        const { project, category } = req.body;

        if (!project) {
            return res.status(400).json({ message: 'Project is required' });
        }

        // Parse Excel from buffer
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (!data || data.length === 0) {
            return res.status(400).json({ message: 'No data found in the Excel file' });
        }

        // Fetch defaults
        const defaultStatus = await TaskStatus.findOne({ status: 'active' });
        let pendingStatus = await TaskStatus.findOne({ name: { $regex: /^pending$/i } });
        if (!pendingStatus) pendingStatus = defaultStatus;

        // Fetch all possible task statuses for lookup
        const allStatuses = await TaskStatus.find({});
        const statusMap = {};
        allStatuses.forEach(s => {
            statusMap[s.name.toLowerCase()] = s._id;
        });

        // Collect all distinct emails to fetch users in one go
        const emails = data.map(row => row['Assignee Email']).filter(Boolean);
        const users = await User.find({ email: { $in: emails } });
        const userMap = {};
        users.forEach(u => {
            userMap[u.email.toLowerCase()] = u._id;
        });

        const projectDoc = await Project.findById(project).select('members').lean();
        if (!projectDoc) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const projectMembersStrings = projectDoc.members.map(id => id.toString());

        // Fetch existing task/issue names for uniqueness check
        const existingProjectTasks = await Task.find({ project, category }).select('name');
        const existingNames = new Set(existingProjectTasks.map(t => t.name.toLowerCase()));
        const newNamesInBatch = new Set();

        const validTasks = [];
        const errors = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];

            const title = row['Title'] || row['Name'];
            const description = row['Description'] || '';
            const assigneeEmail = row['Assignee Email']?.toLowerCase();
            const statusName = row['Status']?.trim().toLowerCase();

            if (!title && !assigneeEmail) continue;

            if (!title) {
                errors.push({ row: i + 2, message: 'Title is required' });
                continue;
            }

            const titleLower = title.toLowerCase();
            if (existingNames.has(titleLower) || newNamesInBatch.has(titleLower)) {
                errors.push({ row: i + 2, message: `A ${category.toLowerCase()} with this title already exists` });
                continue;
            }

            if (!assigneeEmail) {
                errors.push({ row: i + 2, message: 'Assignee Email is required' });
                continue;
            }

            const assigneeId = userMap[assigneeEmail];

            if (!assigneeId) {
                errors.push({ row: i + 2, message: `User ${assigneeEmail} not found` });
                continue;
            }

            if (!projectMembersStrings.includes(assigneeId.toString())) {
                errors.push({ row: i + 2, message: `User not member of project` });
                continue;
            }

            let taskStatusId = pendingStatus?._id;

            if (statusName && statusMap[statusName]) {
                taskStatusId = statusMap[statusName];
            }

            validTasks.push({
                name: title,
                description,
                taskStatus: taskStatusId,
                status: 'active',
                assignee: assigneeId,
                project,
                category: category || 'TASK'
            });

            newNamesInBatch.add(titleLower);
        }

        if (validTasks.length > 0) {
            const insertedTasks = await Task.insertMany(validTasks);

            const assignedBy = req.user.name;
            const baseUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:3000';
            const loginLink = `${baseUrl}/login`;

            const userLookup = {};
            users.forEach(u => {
                userLookup[u._id.toString()] = { email: u.email, name: u.name };
            });

            // Send email notification to assignees asynchronously
            insertedTasks.forEach(task => {
                const assigneeInfo = userLookup[task.assignee.toString()];
                if (assigneeInfo) {
                    sendTaskAssignmentEmail(
                        assigneeInfo.email,
                        task.name,
                        assigneeInfo.name,
                        assignedBy,
                        [], // no attachments supported in bulk upload currently
                        loginLink,
                        task.category
                    );
                }
            });
        }

        res.status(200).json({
            message: `Successfully inserted ${validTasks.length} records.`,
            errors,
            insertedCount: validTasks.length
        });

    } catch (error) {
        console.error('Bulk upload error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createTask,
    getTasks,
    getTaskById,
    updateTask,
    deleteTask,
    bulkUploadTasks
};
