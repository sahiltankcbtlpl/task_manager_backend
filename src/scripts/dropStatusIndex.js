const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const dropIndex = async () => {
    await connectDB();
    try {
        const indexes = await mongoose.connection.collection('taskstatus').indexes();
        console.log('Current Indexes:', indexes);

        // Check if status_1 exists before dropping
        const indexExists = indexes.some(idx => idx.name === 'status_1');

        if (indexExists) {
            await mongoose.connection.collection('taskstatus').dropIndex('status_1');
            console.log('Index status_1 dropped successfully');
        } else {
            console.log('Index status_1 does not exist.');
        }
    } catch (error) {
        console.log('Error dropping index:', error.message);
    }
    process.exit();
};

dropIndex();
