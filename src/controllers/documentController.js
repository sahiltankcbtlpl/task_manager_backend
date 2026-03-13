const Document = require('../models/Document');
const Project = require('../models/Project');
const { isUserProjectMember } = require('../utils/projectHelper');
const { sendReviewRequestMail, sendReviewResponseMail, sendDocumentSharedMail } = require('../services/email.service');
const path = require('path');
const fs = require('fs');

// @desc    Upload a new document
// @route   POST /api/documents
// @access  Private
const createDocument = async (req, res) => {
    try {
        const { project, name, description, allowedUsers, isEditorDocument, content, permissions } = req.body;

        if (!project || !name || !description) {
            return res.status(400).json({ message: 'Project, name, and description are required' });
        }

        if (!req.file && isEditorDocument !== 'true' && isEditorDocument !== true) {
            return res.status(400).json({ message: 'File is required' });
        }

        const isMember = await isUserProjectMember(project, req.user._id);
        if (!isMember && req.user.role.name !== 'Super Admin') {
            return res.status(403).json({ message: 'Not authorized for this project' });
        }

        // Parse allowedUsers safely
        let parsedAllowedUsers = [];
        if (allowedUsers) {
            try {
                parsedAllowedUsers = JSON.parse(allowedUsers);
            } catch (e) {
                // if it's not JSON, it might just be a string or array of strings depending on frontend
                parsedAllowedUsers = Array.isArray(allowedUsers) ? allowedUsers : [allowedUsers];
            }
        }

        // Parse permissions if present
        let parsedPermissions = [];
        if (permissions) {
            try {
                parsedPermissions = typeof permissions === 'string' ? JSON.parse(permissions) : permissions;
            } catch (e) {
                parsedPermissions = permissions;
            }
        }

        // Add owner to allowedUsers automatically if not present
        if (!parsedAllowedUsers.includes(req.user._id.toString())) {
            parsedAllowedUsers.push(req.user._id);
        }

        // If it's an editor document, sync permissions with allowedUsers
        if ((isEditorDocument === 'true' || isEditorDocument === true) && parsedPermissions.length > 0) {
            parsedPermissions.forEach(p => {
                const userId = p.user.toString();
                if (!parsedAllowedUsers.map(id => id.toString()).includes(userId)) {
                    parsedAllowedUsers.push(p.user);
                }
            });
        }

        const documentData = {
            project,
            name,
            description,
            owner: req.user._id,
            allowedUsers: parsedAllowedUsers,
            isEditorDocument: isEditorDocument === 'true' || isEditorDocument === true,
            content: content || '',
            permissions: parsedPermissions
        };

        if (req.file) {
            documentData.fileUrl = req.file.path;
            documentData.fileName = req.file.originalname;
            documentData.mimetype = req.file.mimetype;
            documentData.size = req.file.size;
        }

        const document = await Document.create(documentData);

        const populatedDoc = await document.populate([
            { path: 'owner', select: 'name email' },
            { path: 'allowedUsers', select: 'name email' },
            { path: 'project', select: 'title' }
        ]);

        // Send Email to allowed users
        const baseUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:3000';
        const docLink = `${baseUrl}/documents?project=${project}&sharedDoc=${populatedDoc._id}`;
        populatedDoc.allowedUsers.forEach(user => {
            if (user._id.toString() !== req.user._id.toString()) {
                sendDocumentSharedMail(
                    user.email,
                    user.name,
                    populatedDoc.name,
                    populatedDoc.project?.title || 'your project',
                    docLink
                );
            }
        });

        res.status(201).json(populatedDoc);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get all documents (filtered by project optional)
// @route   GET /api/documents
// @access  Private
const getDocuments = async (req, res) => {
    try {
        const { project, page = 1, limit = 10, search } = req.query;
        let query = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        if (project) {
            // Check if user is a member of the project or Super Admin
            const isMember = await isUserProjectMember(project, req.user._id);
            if (!isMember && req.user.role.name !== 'Super Admin') {
                return res.status(403).json({ message: 'Not authorized for this project' });
            }
            query.project = project;
        } else if (req.user.role.name !== 'Super Admin') {
            const userProjects = await Project.find({ members: req.user._id }).select('_id');
            const projectIds = userProjects.map(p => p._id);
            query.project = { $in: projectIds };
        }

        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const startIndex = (pageNum - 1) * limitNum;
        const total = await Document.countDocuments(query);

        let documents = await Document.find(query)
            .populate('owner', 'name email')
            .populate('allowedUsers', 'name email')
            .populate('reviewRequests.requestedBy', 'name email')
            .populate('project', 'title')
            .sort({ createdAt: -1 })
            .skip(startIndex)
            .limit(limitNum);

        // Add visibility logic for frontend mapping
        const responseDocs = documents.map(doc => {
            const docObj = doc.toObject();

            // Check permissions
            const isOwner = doc.owner._id.toString() === req.user._id.toString();
            const SuperAdmin = req.user.role.name === 'Super Admin';
            const isAllowed = doc.allowedUsers.some(user => user._id.toString() === req.user._id.toString());
            const hasPermission = doc.permissions?.some(p => p.user.toString() === req.user._id.toString());
            const hasEditPermission = doc.permissions?.some(p => p.user.toString() === req.user._id.toString() && p.access === 'edit');

            const hasAccess = isOwner || isAllowed || SuperAdmin || hasPermission;
            const canEdit = isOwner || SuperAdmin || hasEditPermission;

            // Restrict sensitive info if not allowed
            if (!hasAccess) {
                delete docObj.fileUrl; // Don't send file URL
            } else if (docObj.fileUrl) {
                // Ensure fileUrl starts with / if it doesn't already, assuming 'uploads/...'
                if (!docObj.fileUrl.startsWith('/') && !docObj.fileUrl.startsWith('http')) {
                    docObj.fileUrl = `/${docObj.fileUrl.replace(/\\/g, '/')}`;
                }
            }

            return {
                ...docObj,
                project: docObj.project,
                hasAccess,
                isOwner,
                canEdit
            };
        });

        res.json({
            documents: responseDocs,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(total / limitNum),
                pageSize: limitNum,
                totalItems: total
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Request a review for a document
// @route   POST /api/documents/:id/request-review
// @access  Private
const requestReview = async (req, res) => {
    try {
        const documentId = req.params.id;
        const userId = req.user._id;
        const { requestType = 'view' } = req.body;

        const docCheck = await Document.findById(documentId);
        if (!docCheck) {
            return res.status(404).json({ message: 'Document not found' });
        }

        const isMember = await isUserProjectMember(docCheck.project, userId);
        if (!isMember && req.user.role.name !== 'Super Admin') {
            return res.status(403).json({ message: 'Not authorized for this project' });
        }

        // Check if a pending request of the SAME type already exists
        const pendingRequest = docCheck.reviewRequests.find(r => 
            r.requestedBy.toString() === userId.toString() && 
            r.requestType === requestType && 
            r.status === 'pending'
        );

        if (pendingRequest) {
            return res.status(400).json({ message: `A pending ${requestType} request already exists or document not found` });
        }

        const document = await Document.findByIdAndUpdate(
            documentId,
            {
                $push: {
                    reviewRequests: { requestedBy: userId, status: 'pending', requestType }
                }
            },
            { new: true }
        ).populate('owner', 'name email');

        if (!document) {
            return res.status(400).json({ message: 'Review request already exists or document not found' });
        }

        const populatedDoc = await document.populate([
            { path: 'owner', select: 'name email' },
            { path: 'allowedUsers', select: 'name email' },
            { path: 'reviewRequests.requestedBy', select: 'name email' },
            { path: 'project', select: 'title' }
        ]);

        const baseUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:3000';
        const docLink = `${baseUrl}/documents?review=${documentId}&project=${document.project._id || document.project}`;

        sendReviewRequestMail(
            document.owner.email,
            document.owner.name,
            document.name,
            req.user.name,
            docLink,
            requestType
        );

        res.status(200).json(populatedDoc);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Respond to a review request
// @route   PUT /api/documents/:id/respond-review
// @access  Private (Owner only)
const respondToReview = async (req, res) => {
    try {
        const { id: documentId } = req.params;
        const { requestId, status } = req.body;

        if (!['accepted', 'declined'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const document = await Document.findById(documentId).populate('reviewRequests.requestedBy', 'name email');

        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }

        if (document.owner.toString() !== req.user._id.toString() && req.user.role.name !== 'Super Admin') {
            return res.status(403).json({ message: 'Not authorized to respond to this request (owner only)' });
        }

        const requestIndex = document.reviewRequests.findIndex(r => r._id.toString() === requestId);

        if (requestIndex === -1) {
            return res.status(404).json({ message: 'Review request not found' });
        }

        const reviewRequest = document.reviewRequests[requestIndex];

        if (reviewRequest.status !== 'pending') {
            return res.status(400).json({ message: 'Request has already been processed' });
        }

        document.reviewRequests[requestIndex].status = status;

        if (status === 'accepted') {
            if (!document.allowedUsers.includes(reviewRequest.requestedBy._id)) {
                document.allowedUsers.push(reviewRequest.requestedBy._id);
            }
            
            // For rich text documents, also add to granular permissions if not present
            if (document.isEditorDocument) {
                const existingPerm = document.permissions?.find(p => p.user.toString() === reviewRequest.requestedBy._id.toString());
                const accessLevel = reviewRequest.requestType === 'edit' ? 'edit' : 'view';

                if (!existingPerm) {
                    document.permissions.push({
                        user: reviewRequest.requestedBy._id,
                        access: accessLevel
                    });
                } else if (accessLevel === 'edit') {
                    // Upgrade to edit if currently view
                    existingPerm.access = 'edit';
                }
            }
        }

        await document.save();

        const baseUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:3000';
        const docLink = `${baseUrl}/documents?project=${document.project._id || document.project}${status === 'accepted' ? `&sharedDoc=${document._id}` : ''}`;
        sendReviewResponseMail(
            reviewRequest.requestedBy.email,
            reviewRequest.requestedBy.name,
            document.name,
            status,
            docLink
        );

        res.status(200).json({ message: `Review request ${status}` });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update a document
// @route   PUT /api/documents/:id
// @access  Private (Owner only)
const updateDocument = async (req, res) => {
    try {
        const { name, description, allowedUsers, content, permissions } = req.body;
        const document = await Document.findById(req.params.id);

        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }

        const oldAllowedUserIds = document.allowedUsers.map(id => id.toString());

        if (document.owner.toString() !== req.user._id.toString() && req.user.role.name !== 'Super Admin') {
            const userPermission = document.permissions?.find(p => p.user.toString() === req.user._id.toString());
            if (!userPermission || userPermission.access !== 'edit') {
                return res.status(403).json({ message: 'Not authorized to update this document' });
            }
        }

        if (name) document.name = name;
        if (description !== undefined) document.description = description;
        if (content !== undefined) document.content = content;
        if (permissions) {
            try {
                document.permissions = typeof permissions === 'string' ? JSON.parse(permissions) : permissions;
                
                // Keep allowedUsers in sync with permissions for rich text documents
                if (document.isEditorDocument) {
                    const permissionUserIds = document.permissions.map(p => p.user.toString());
                    // Only keep users who have a record in permissions or are the owner
                    document.allowedUsers = document.allowedUsers.filter(userId => 
                        permissionUserIds.includes(userId.toString()) || 
                        userId.toString() === document.owner.toString()
                    );
                    
                    // Also ensure all users in permissions are in allowedUsers
                    permissionUserIds.forEach(uid => {
                        if (!document.allowedUsers.map(id => id.toString()).includes(uid)) {
                            document.allowedUsers.push(uid);
                        }
                    });
                }
            } catch (e) {
                document.permissions = permissions;
            }
        }

        if (allowedUsers) {
            let parsedAllowedUsers = [];
            try {
                parsedAllowedUsers = JSON.parse(allowedUsers);
            } catch (e) {
                parsedAllowedUsers = Array.isArray(allowedUsers) ? allowedUsers : [allowedUsers];
            }
            if (!parsedAllowedUsers.includes(document.owner.toString())) {
                parsedAllowedUsers.push(document.owner);
            }
            document.allowedUsers = parsedAllowedUsers;
        }

        if (req.file) {
            if (document.fileUrl) {
                const oldFilePath = path.resolve(document.fileUrl);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            }

            document.fileUrl = req.file.path;
            document.fileName = req.file.originalname;
            document.mimetype = req.file.mimetype;
            document.size = req.file.size;
        } else if (req.body.removeFile === 'true') {
            if (document.fileUrl) {
                const oldFilePath = path.resolve(document.fileUrl);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            }
            document.fileUrl = undefined;
            document.fileName = undefined;
            document.mimetype = undefined;
            document.size = undefined;
        }

        const updatedDoc = await document.save();
        const populatedDoc = await updatedDoc.populate([
            { path: 'owner', select: 'name email' },
            { path: 'allowedUsers', select: 'name email' },
            { path: 'project', select: 'title' }
        ]);

        // Identify newly added users to send emails
        const newAllowedUsers = populatedDoc.allowedUsers.filter(user => 
            !oldAllowedUserIds.includes(user._id.toString()) && 
            user._id.toString() !== req.user._id.toString()
        );

        if (newAllowedUsers.length > 0) {
            const baseUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:3000';
            const docLink = `${baseUrl}/documents?project=${populatedDoc.project._id || populatedDoc.project}&sharedDoc=${populatedDoc._id}`;
            
            newAllowedUsers.forEach(user => {
                sendDocumentSharedMail(
                    user.email,
                    user.name,
                    populatedDoc.name,
                    populatedDoc.project?.title || 'your project',
                    docLink
                );
            });
        }

        res.status(200).json(populatedDoc);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete a document
// @route   DELETE /api/documents/:id
// @access  Private (Owner only)
const deleteDocument = async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);

        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }

        if (document.owner.toString() !== req.user._id.toString() && req.user.role.name !== 'Super Admin') {
            return res.status(403).json({ message: 'Not authorized to delete this document' });
        }

        if (document.fileUrl) {
            const filePath = path.resolve(document.fileUrl);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await document.deleteOne();
        res.status(200).json({ message: 'Document deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Autosave document content (lightweight)
// @route   PATCH /api/documents/:id/autosave
// @access  Private
const autosaveDocument = async (req, res) => {
    try {
        const { content, name, permissions } = req.body;
        const document = await Document.findById(req.params.id);

        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }

        const isOwner = document.owner.toString() === req.user._id.toString();
        const hasEditPermission = document.permissions?.some(p => p.user.toString() === req.user._id.toString() && p.access === 'edit');
        
        if (!isOwner && !hasEditPermission && req.user.role.name !== 'Super Admin') {
            return res.status(403).json({ message: 'No edit permission' });
        }

        if (content !== undefined) document.content = content;
        if (name) document.name = name;

        if (permissions) {
            try {
                document.permissions = typeof permissions === 'string' ? JSON.parse(permissions) : permissions;
            } catch (e) {
                document.permissions = permissions;
            }
        }

        // Sync allowedUsers with permissions for rich text documents during autosave
        if (document.isEditorDocument && document.permissions) {
            const permissionUserIds = document.permissions.map(p => p.user.toString());
            document.allowedUsers = document.allowedUsers.filter(userId => 
                permissionUserIds.includes(userId.toString()) || 
                userId.toString() === document.owner.toString()
            );
            
            permissionUserIds.forEach(uid => {
                if (!document.allowedUsers.map(id => id.toString()).includes(uid)) {
                    document.allowedUsers.push(uid);
                }
            });
        }

        const updatedDoc = await document.save();
        res.status(200).json(updatedDoc);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Request access to a document
// @route   POST /api/documents/:id/request-access
// @access  Private
const requestAccess = async (req, res) => {
    return requestReview(req, res);
};

module.exports = {
    createDocument,
    getDocuments,
    requestReview,
    respondToReview,
    updateDocument,
    deleteDocument,
    autosaveDocument,
    requestAccess
};
