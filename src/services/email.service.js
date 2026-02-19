const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendTaskAssignmentEmail = async (to, taskName, assigneeName, assignedBy) => {
    try {
        const info = await transporter.sendMail({
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
        });

        console.log('Mail sent:', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        return null;
    }
};

module.exports = {
    sendTaskAssignmentEmail,
};
