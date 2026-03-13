const nodemailer = require('nodemailer');
const generateEmailTemplate = require('../utils/emailTemplate');

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendTaskAssignmentEmail = (to, taskName, assigneeName, assignedBy, attachments = [], loginLink, category = 'TASK') => {
    const isIssue = category === 'ISSUE';
    const itemName = isIssue ? 'issue' : 'task';
    const ItemName = isIssue ? 'Issue' : 'Task';

    const htmlContent = generateEmailTemplate(
        `New ${ItemName} Assigned: ${taskName}`,
        `
            <h3>Hello ${assigneeName},</h3>
            <p>You have been assigned a new ${itemName}: <strong>${taskName}</strong></p>
            <div class="highlight-box">
                <p style="margin: 0;"><strong>Assigned by:</strong> ${assignedBy}</p>
            </div>
            <p>Please log in to the Task Manager to view more details.</p>
            ${loginLink ? `<a href="${loginLink}" class="action-button" style="color: #ffffff;">Log In to Task Manager</a>` : ''}
        `
    );

    const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`, // sender address
        to: to, // list of receivers
        subject: `New ${ItemName} Assigned: ${taskName}`, // Subject line
        html: htmlContent, // html body
    };

    if (attachments && attachments.length > 0) {
        // Nodemailer expects { filename, path } format for attachments
        mailOptions.attachments = attachments.map(att => ({
            filename: att.filename,
            path: att.path
        }));
    }

    transporter.sendMail(mailOptions)
        .then(info => console.log('Mail sent:', info.messageId))
        .catch(error => console.error('Error sending email:', error));
};

const sendProjectAssignmentEmail = (to, assigneeName, projectTitle, projectDescription, loginLink) => {
    const htmlContent = generateEmailTemplate(
        'Assigned to New Project',
        `
            <h3>Hello ${assigneeName},</h3>
            <p>You have been assigned to the project: <strong>${projectTitle}</strong></p>
            <div class="highlight-box">
                <p style="margin: 0;"><strong>Description:</strong> ${projectDescription}</p>
            </div>
            <p>Please log in to the Task Manager to view more details.</p>
            ${loginLink ? `<a href="${loginLink}" class="action-button" style="color: #ffffff;">Log In to Task Manager</a>` : ''}
        `
    );

    const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
        to: to,
        subject: 'Assigned to New Project',
        html: htmlContent,
    };

    transporter.sendMail(mailOptions)
        .then(info => console.log('Project Mail sent:', info.messageId))
        .catch(error => console.error('Error sending project email:', error));
};

const sendMentionEmail = (to, assigneeName, projectName, projectDescription, loginLink) => {
    const htmlContent = generateEmailTemplate(
        'You were mentioned in a project',
        `
            <h3>Hello ${assigneeName},</h3>
            <p>You have been mentioned in the description of the project: <strong>${projectName}</strong>.</p>
            <div class="highlight-box">
                <p style="margin: 0;"><strong>Description:</strong> ${projectDescription}</p>
            </div>
            <p>Please log in to the Task Manager to view more details.</p>
            ${loginLink ? `<a href="${loginLink}" class="action-button" style="color: #ffffff;">Log In to Task Manager</a>` : ''}
        `
    );

    const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
        to: to,
        subject: `You were mentioned in a project`,
        html: htmlContent,
    };

    transporter.sendMail(mailOptions)
        .then(info => console.log('Mention Mail sent:', info.messageId))
        .catch(error => console.error('Error sending mention email:', error));
};

const sendReviewRequestMail = (ownerEmail, ownerName, documentName, requesterName, loginLink, requestType = 'view') => {
    const typeLabel = requestType === 'edit' ? 'Edit Access' : 'Review';
    const htmlContent = generateEmailTemplate(
        `${typeLabel} Request: ${documentName}`,
        `
            <h3>Hello ${ownerName},</h3>
            <p><strong>${requesterName}</strong> has requested <strong>${typeLabel.toLowerCase()}</strong> for the document: <strong>${documentName}</strong>.</p>
            <p>Please log in to accept or decline the request.</p>
            <a href="${loginLink}" class="action-button" style="color: #ffffff;">View Request</a>
        `
    );

    const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
        to: ownerEmail,
        subject: `${typeLabel} Request: ${documentName}`,
        html: htmlContent,
    };

    transporter.sendMail(mailOptions)
        .then(info => console.log('Review Request Mail sent:', info.messageId))
        .catch(error => console.error('Error sending review request email:', error));
};

const sendReviewResponseMail = (requesterEmail, requesterName, documentName, status, loginLink) => {
    const statusFormatted = status.charAt(0).toUpperCase() + status.slice(1);
    const htmlContent = generateEmailTemplate(
        `Review Request ${statusFormatted}: ${documentName}`,
        `
            <h3>Hello ${requesterName},</h3>
            <p>Your review request for the document <strong>${documentName}</strong> has been <strong style="color: ${status === 'accepted' ? '#10b981' : '#ef4444'};">${status}</strong>.</p>
            <p>Please log in to view the document.</p>
            <a href="${loginLink}" class="action-button" style="color: #ffffff;">View Document</a>
        `
    );

    const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
        to: requesterEmail,
        subject: `Review Request ${statusFormatted}: ${documentName}`,
        html: htmlContent,
    };

    transporter.sendMail(mailOptions)
        .then(info => console.log('Review Response Mail sent:', info.messageId))
        .catch(error => console.error('Error sending review response email:', error));
};

const sendDocumentSharedMail = (to, userName, documentName, projectName, loginLink) => {
    const htmlContent = generateEmailTemplate(
        `Document Shared: ${documentName}`,
        `
            <h3>Hello ${userName},</h3>
            <p>A new document <strong>${documentName}</strong> has been shared with you in the project <strong>${projectName}</strong>.</p>
            <p>Please log in to view the document.</p>
            <a href="${loginLink}" class="action-button" style="color: #ffffff;">View Document</a>
        `
    );

    const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
        to: to,
        subject: `Document Shared: ${documentName}`,
        html: htmlContent,
    };

    transporter.sendMail(mailOptions)
        .then(info => console.log('Document Shared Mail sent:', info.messageId))
        .catch(error => console.error('Error sending document shared email:', error));
};

module.exports = {
    sendTaskAssignmentEmail,
    sendProjectAssignmentEmail,
    sendMentionEmail,
    sendReviewRequestMail,
    sendReviewResponseMail,
    sendDocumentSharedMail,
};
