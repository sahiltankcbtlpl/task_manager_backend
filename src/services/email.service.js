const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendTaskAssignmentEmail = async (to, taskName, assigneeName, assignedBy, attachments = []) => {
    try {
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

        const info = await transporter.sendMail(mailOptions);

        console.log('Mail sent:', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        return null;
    }
};

const sendProjectAssignmentEmail = async (to, assigneeName, projectTitle, projectDescription) => {
    try {
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

        const info = await transporter.sendMail(mailOptions);
        console.log('Project Mail sent:', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending project email:', error);
        return null;
    }
};

module.exports = {
    sendTaskAssignmentEmail,
    sendProjectAssignmentEmail,
};
