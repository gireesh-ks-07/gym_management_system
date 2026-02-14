const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sequelize, User, Gym, Client, Plan, Payment } = require('./models');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'supersecretkey'; // Use env variable in production

app.use(cors());
app.use(bodyParser.json());

// Middleware for auth
const authenticate = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Failed to authenticate token' });
        req.user = decoded;
        next();
    });
};

const authorize = (roles = []) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        next();
    };
};

// --- AUTH ROUTES ---

app.post('/api/auth/register', async (req, res) => {
    // Only for initial setup or specific use case. 
    // In a real app, only Superadmin creates Admins, and Admins create Trainers.
    try {
        const { name, email, password, role, gymId } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashedPassword, role, gymId });
        res.json({ message: 'User registered successfully', user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, role: user.role, gymId: user.gymId }, SECRET_KEY, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, gymId: user.gymId } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- GYM ROUTES (Superadmin) ---

app.post('/api/gyms', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { name, address, adminEmail, adminPassword, adminName } = req.body;
        const gym = await Gym.create({ name, address });

        // Create initial admin for the gym
        if (adminEmail && adminPassword) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            await User.create({
                name: adminName || 'Admin',
                email: adminEmail,
                password: hashedPassword,
                role: 'admin',
                gymId: gym.id
            });
        }

        res.json(gym);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/gyms', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const gyms = await Gym.findAll({ include: User });
        res.json(gyms);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- CLIENT ROUTES (Admin, Trainer) ---

app.post('/api/clients', authenticate, authorize(['admin', 'trainer']), async (req, res) => {
    try {
        const { name, email, phone, height, weight, joiningDate, gender } = req.body;
        // Ensure the trainer/admin belongs to a gym
        if (!req.user.gymId) return res.status(400).json({ message: 'User not associated with a gym' });

        const client = await Client.create({
            name, email, phone, height, weight, joiningDate, gender,
            planId: req.body.planId || null,
            gymId: req.user.gymId,
            addedBy: req.user.id
        });
        res.json(client);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/clients', authenticate, authorize(['admin', 'trainer', 'superadmin']), async (req, res) => {
    try {
        let where = {};
        if (req.user.role !== 'superadmin') {
            where.gymId = req.user.gymId;
        }
        const clients = await Client.findAll({ where });
        res.json(clients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- STAFF ROUTES (Admin) ---

app.post('/api/staff', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { name, email, password, role } = req.body; // role should be 'trainer'
        if (role !== 'trainer') return res.status(400).json({ message: 'Admins create trainers only' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const staff = await User.create({
            name, email, password: hashedPassword, role, gymId: req.user.gymId
        });
        res.json(staff);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/staff', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const staff = await User.findAll({ where: { gymId: req.user.gymId, role: 'trainer' } });
        res.json(staff);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// --- PLAN ROUTES (Admin) ---

app.post('/api/plans', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { name, price, duration, description } = req.body;
        const plan = await Plan.create({
            name, price, duration, description,
            gymId: req.user.gymId
        });
        res.json(plan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/plans', authenticate, authorize(['admin', 'trainer', 'superadmin']), async (req, res) => {
    try {
        const plans = await Plan.findAll({ where: { gymId: req.user.gymId } });
        res.json(plans);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- DASHBOARD ROUTE ---
app.get('/api/dashboard', authenticate, authorize(['admin', 'trainer', 'superadmin']), async (req, res) => {
    try {
        const gymId = req.user.gymId;

        // 1. Total Active Clients
        const totalClients = await Client.count({ where: { gymId } });

        // 2. Revenue (Total, Monthly)
        const totalRevenue = await Payment.sum('amount', { where: { gymId } }) || 0;

        // 3. Active Trainers
        const activeTrainers = await User.count({ where: { gymId, role: 'trainer' } });

        // 4. Recent Clients (Last 5)
        const recentClients = await Client.findAll({
            where: { gymId },
            limit: 5,
            order: [['createdAt', 'DESC']],
            include: [{ model: Plan, attributes: ['name'] }]
        });

        // 5. Revenue by Month (Last 6 months) for Chart
        // Simplify: just fetch all payments and aggregate in JS for now to avoid complex SQL on sqlite
        const payments = await Payment.findAll({
            where: { gymId },
            attributes: ['amount', 'date', 'method']
        });

        const revenueByMonth = {}; // 'YYYY-MM': total
        const revenueByMethod = { cash: 0, upi: 0 };

        payments.forEach(p => {
            const month = p.date.substring(0, 7); // 'YYYY-MM'
            revenueByMonth[month] = (revenueByMonth[month] || 0) + p.amount;
            if (revenueByMethod[p.method] !== undefined) revenueByMethod[p.method] += p.amount;
        });

        const revenueChartData = Object.entries(revenueByMonth)
            .map(([date, amount]) => ({ date, amount }))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-6); // Last 6 months

        // 6. Clients by Plan
        const clientsByPlan = await Client.findAll({
            where: { gymId },
            include: [{ model: Plan, attributes: ['name'] }],
            attributes: ['planId']
        });

        const planDistribution = {};
        clientsByPlan.forEach(c => {
            const planName = c.Plan ? c.Plan.name : 'No Plan';
            planDistribution[planName] = (planDistribution[planName] || 0) + 1;
        });

        const planChartData = Object.entries(planDistribution).map(([name, value]) => ({ name, value }));

        res.json({
            stats: {
                totalClients,
                totalRevenue,
                activeTrainers
            },
            recentClients,
            revenueChartData,
            revenueByMethod,
            planChartData
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- PAYMENT ROUTES ---


app.post('/api/payments', authenticate, authorize(['admin', 'trainer']), async (req, res) => {
    try {
        const { clientId, amount, method, date } = req.body;
        const payment = await Payment.create({
            clientId,
            amount,
            method,
            date,
            gymId: req.user.gymId
        });
        res.json(payment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/payments', authenticate, authorize(['admin', 'trainer']), async (req, res) => {
    try {
        const payments = await Payment.findAll({
            where: { gymId: req.user.gymId },
            include: [{ model: Client, attributes: ['name'] }],
            order: [['date', 'DESC']]
        });
        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/reports', authenticate, authorize(['admin', 'superadmin']), async (req, res) => {
    try {
        const gymId = req.user.gymId;
        const clientWhere = gymId ? { gymId } : {};

        // Gender Stats
        const clients = await Client.findAll({ where: clientWhere });
        const genderStats = { male: 0, female: 0, other: 0 };
        clients.forEach(c => {
            if (genderStats[c.gender] !== undefined) genderStats[c.gender]++;
        });

        // Payment Stats
        const updatedWhere = gymId ? { gymId } : {};
        const payments = await Payment.findAll({ where: updatedWhere });
        const revenue = { total: 0, cash: 0, upi: 0 };
        payments.forEach(p => {
            revenue.total += p.amount;
            if (p.method === 'cash') revenue.cash += p.amount;
            if (p.method === 'upi') revenue.upi += p.amount;
        });

        res.json({ genderStats, revenue });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- UPDATE & DELETE ROUTES ---

app.put('/api/gyms/:id', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { name, address } = req.body;
        const gym = await Gym.findByPk(req.params.id);
        if (!gym) return res.status(404).json({ message: 'Gym not found' });

        gym.name = name;
        gym.address = address;
        await gym.save();
        res.json(gym);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/gyms/:id', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const gym = await Gym.findByPk(req.params.id);
        if (!gym) return res.status(404).json({ message: 'Gym not found' });
        await gym.destroy();
        res.json({ message: 'Gym deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/clients/:id', authenticate, authorize(['admin', 'trainer']), async (req, res) => {
    try {
        const { name, email, phone, height, weight, joiningDate, gender } = req.body;
        const client = await Client.findOne({ where: { id: req.params.id, gymId: req.user.gymId } });

        if (!client) return res.status(404).json({ message: 'Client not found' });

        client.name = name;
        client.email = email;
        client.phone = phone;
        client.height = height;
        client.weight = weight;
        client.joiningDate = joiningDate;
        client.gender = gender;
        if (req.body.planId) client.planId = req.body.planId;
        await client.save();
        res.json(client);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/clients/:id', authenticate, authorize(['admin', 'trainer']), async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, gymId: req.user.gymId } });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        await client.destroy();
        res.json({ message: 'Client deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/staff/:id', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { name, email } = req.body;
        const staff = await User.findOne({ where: { id: req.params.id, gymId: req.user.gymId, role: 'trainer' } });

        if (!staff) return res.status(404).json({ message: 'Staff member not found' });

        staff.name = name;
        staff.email = email;
        await staff.save();
        res.json(staff);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/staff/:id', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const staff = await User.findOne({ where: { id: req.params.id, gymId: req.user.gymId, role: 'trainer' } });
        if (!staff) return res.status(404).json({ message: 'Staff member not found' });
        await staff.destroy();
        res.json({ message: 'Staff deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/plans/:id', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const plan = await Plan.findOne({ where: { id: req.params.id, gymId: req.user.gymId } });
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        await plan.destroy();
        res.json({ message: 'Plan deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Initialize DB and Start Server
sequelize.sync({ force: false }).then(async () => {
    // Create default superadmin if not exists
    const superadmin = await User.findOne({ where: { role: 'superadmin' } });
    if (!superadmin) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await User.create({
            name: 'Super Admin',
            email: 'super@admin.com',
            password: hashedPassword,
            role: 'superadmin'
        });
        console.log('Superadmin created: super@admin.com / admin123');
    }

    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Unable to connect to the database:', err);
});
