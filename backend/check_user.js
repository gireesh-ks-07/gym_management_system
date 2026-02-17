const { User } = require('./models');

async function checkUser() {
    try {
        const user = await User.findOne({ where: { email: 'admin@gym1.com' } });
        if (user) {
            console.log('User found:', JSON.stringify(user, null, 2));
        } else {
            console.log('User admin@gym1.com NOT found');
            const allUsers = await User.findAll({ attributes: ['email', 'role'] });
            console.log('All users:', JSON.stringify(allUsers, null, 2));
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkUser();
