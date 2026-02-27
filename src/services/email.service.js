const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendTaskAssignmentEmail = (to, taskName, assigneeName, assignedBy, attachments = []) => {
    const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`, // sender address
        to: to, // list of receivers
        subject: `New Task Assigned: ${taskName}`, // Subject line
        html: `
            <h3>Hello ${assigneeName},</h3>
            <p>You have been assigned a new task: <strong>${taskName}</strong></p>
            <p>Assigned by: ${assignedBy}</p>
            <p>Please log in to the Task Manager to view more details.</p>
            <br>
            <p>Best regards,</p>
            <p>Task Manager Team</p>
        `, // html body
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

const sendProjectAssignmentEmail = (to, assigneeName, projectTitle, projectDescription) => {
    const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
        to: to,
        subject: 'Assigned to New Project',
        html: `
            <h3>Hello ${assigneeName},</h3>
            <p>You have been assigned to the project: <strong>${projectTitle}</strong></p>
            <p>Description: ${projectDescription}</p>
            <p>Please log in to the Task Manager to view more details.</p>
            <br>
            <p>Best regards,</p>
            <p>Task Manager Team</p>
        `,
    };

    transporter.sendMail(mailOptions)
        .then(info => console.log('Project Mail sent:', info.messageId))
        .catch(error => console.error('Error sending project email:', error));
};

const sendMentionEmail = (to, assigneeName, projectName, projectDescription) => {
    const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
        to: to,
        subject: `You were mentioned in a project`,
        html: `
            <h3>Hello ${assigneeName},</h3>
            <p>You have been mentioned in the description of the project: <strong>${projectName}</strong>.</p>
            <p>Description: ${projectDescription}</p>
            <p>Please log in to the Task Manager to view more details.</p>
            <br>
            <p>Best regards,</p>
            <p>Task Manager Team</p>
        `,
    };

    transporter.sendMail(mailOptions)
        .then(info => console.log('Mention Mail sent:', info.messageId))
        .catch(error => console.error('Error sending mention email:', error));
};

module.exports = {
    sendTaskAssignmentEmail,
    sendProjectAssignmentEmail,
    sendMentionEmail,
};
