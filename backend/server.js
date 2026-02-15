const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sequelize, User, Gym, Client, Plan, Payment, SubscriptionPlan, Attendance } = require('./models');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'supersecretkey'; // Use env variable in production

app.use(cors());
app.use(bodyParser.json());

// Middleware for auth
const authenticate = (req, res, next) => {
    console.log('Authenticating path:', req.path);
    const authHeader = req.headers['authorization'];
    console.log('Auth Header:', authHeader);
    const token = authHeader?.split(' ')[1];
    if (!token) {
        console.log('No token found');
        return res.status(401).json({ message: 'No token provided' });
    }

    jwt.verify(token, 'supersecretkey', (err, decoded) => {
        if (err) {
            console.error('JWT Verify Error:', err.message);
            return res.status(401).json({ message: 'Failed to authenticate token' });
        }
        console.log('Decoded User:', decoded);
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

// Middleware to check Gym Subscription Status
const checkSubscriptionStatus = async (req, res, next) => {
    // Superadmin bypasses subscription checks
    if (req.user.role === 'superadmin') return next();

    if (!req.user.gymId) {
        return res.status(400).json({ message: 'User not associated with a gym' });
    }

    try {
        const gym = await Gym.findByPk(req.user.gymId);
        if (!gym) return res.status(404).json({ message: 'Gym not found' });

        // Auto-expire if date passed
        if (gym.subscriptionStatus === 'active' && gym.subscriptionExpiresAt && new Date(gym.subscriptionExpiresAt) < new Date()) {
            gym.subscriptionStatus = 'expired';
            await gym.save();
        }

        if (gym.subscriptionStatus !== 'active') {
            return res.status(403).json({
                message: 'Gym subscription is ' + gym.subscriptionStatus + '. Please contact support.',
                code: 'SUBSCRIPTION_' + gym.subscriptionStatus.toUpperCase()
            });
        }
        next();
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
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

// --- SUBSCRIPTION PLAN ROUTES (Superadmin) ---

app.post('/api/subscription-plans', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { name, price, duration, maxMembers, maxTrainers, description } = req.body;
        const plan = await SubscriptionPlan.create({ name, price, duration, maxMembers, maxTrainers, description });
        res.json(plan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/subscription-plans', authenticate, async (req, res) => {
    try {
        const plans = await SubscriptionPlan.findAll();
        res.json(plans);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- GYM MANAGEMENT ROUTES (Superadmin) ---

app.post('/api/gyms', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { name, address, adminEmail, adminPassword, adminName, planId } = req.body;

        let subscriptionExpiresAt = null;
        if (planId) {
            const plan = await SubscriptionPlan.findByPk(planId);
            if (plan) {
                const now = new Date();
                subscriptionExpiresAt = new Date(now.setMonth(now.getMonth() + plan.duration));
            }
        }

        const gym = await Gym.create({
            name,
            address,
            subscriptionPlanId: planId || null,
            subscriptionExpiresAt,
            subscriptionStatus: planId ? 'active' : 'suspended' // Active if plan assigned
        });

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
        const gyms = await Gym.findAll({
            include: [
                { model: User },
                { model: SubscriptionPlan }
            ]
        });

        // Auto-update expiry status on list view
        const now = new Date();
        for (const gym of gyms) {
            if (gym.subscriptionStatus === 'active' && gym.subscriptionExpiresAt && new Date(gym.subscriptionExpiresAt) < now) {
                gym.subscriptionStatus = 'expired';
                await gym.save(); // This updates the DB record
                // Note: 'gym' object in memory might need manual update if we want frontend to see it immediately without re-fetch, 
                // but usually fine for list.
            }
        }

        res.json(gyms);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/gyms/:id/assign-plan', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { planId } = req.body;
        const gym = await Gym.findByPk(req.params.id);
        const plan = await SubscriptionPlan.findByPk(planId);

        if (!gym || !plan) return res.status(404).json({ message: 'Gym or Plan not found' });

        const now = new Date();
        gym.subscriptionPlanId = plan.id;
        gym.subscriptionStatus = 'active';
        gym.subscriptionExpiresAt = new Date(now.setMonth(now.getMonth() + plan.duration));

        await gym.save();
        res.json(gym);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/gyms/:id/status', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { status } = req.body; // active, suspended
        const gym = await Gym.findByPk(req.params.id);
        if (!gym) return res.status(404).json({ message: 'Gym not found' });

        gym.subscriptionStatus = status;
        await gym.save();
        res.json(gym);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/gyms/:id/subscription-update', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { status, expiresAt } = req.body;
        const gym = await Gym.findByPk(req.params.id);
        if (!gym) return res.status(404).json({ message: 'Gym not found' });

        if (status) gym.subscriptionStatus = status;
        if (expiresAt) gym.subscriptionExpiresAt = new Date(expiresAt);

        await gym.save();
        res.json(gym);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- SUPER ADMIN DASHBOARD ---
app.get('/api/superadmin/dashboard', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const totalGyms = await Gym.count();
        const activeGyms = await Gym.count({ where: { subscriptionStatus: 'active' } });
        const suspendedGyms = await Gym.count({ where: { subscriptionStatus: 'suspended' } });
        const expiredGyms = await Gym.count({ where: { subscriptionStatus: 'expired' } });

        // Calculate Total Revenue (Platform) - Assuming only manual recurring revenue via Subscription Plans
        // For a real SaaS, we'd have a 'PlatformPayment' model. 
        // For this functional proto, we'll estimate based on assigned plans (not accurate but sufficient functionality for now)
        // OR better: Just return the gym counts and status for now, as we don't have a Billing/Invoices table for the SAAS itself yet.

        // Let's create a simplified revenue metric: Sum of (Plan Price) for all active gyms
        const gymsWithPlans = await Gym.findAll({
            where: { subscriptionStatus: 'active' },
            include: [{ model: SubscriptionPlan }]
        });

        const mrr = gymsWithPlans.reduce((sum, gym) => sum + (gym.SubscriptionPlan ? (gym.SubscriptionPlan.price / gym.SubscriptionPlan.duration) : 0), 0);

        // Expiring soon (next 7 days)
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const now = new Date();

        const expiringGyms = await Gym.findAll({
            where: {
                subscriptionStatus: 'active',
                subscriptionExpiresAt: {
                    [sequelize.Op?.between || 'between']: [now, nextWeek] // Check sequelize operator syntax if fails, doing manual filte for simplicity below
                }
            },
            include: [{ model: SubscriptionPlan }]
        });

        res.json({
            stats: {
                totalGyms, activeGyms, suspendedGyms, expiredGyms, mrr
            },
            expiringGyms
        });
    } catch (error) {
        console.error(error); // Log for debugging
        res.status(500).json({ error: error.message });
    }
});

// Endpoint for Gym Admin to check their own subscription
app.get('/api/gym/subscription', authenticate, async (req, res) => {
    try {
        if (!req.user.gymId) return res.status(400).json({ message: 'No gym associated' });
        const gym = await Gym.findByPk(req.user.gymId, { include: [SubscriptionPlan] });
        res.json(gym);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- CLIENT ROUTES (Admin, Trainer) ---

app.post('/api/clients', authenticate, checkSubscriptionStatus, authorize(['admin', 'trainer']), async (req, res) => {
    try {
        const { name, email, phone, height, weight, joiningDate, gender, aadhaar_number, address } = req.body;
        // Ensure the trainer/admin belongs to a gym
        if (!req.user.gymId) return res.status(400).json({ message: 'User not associated with a gym' });

        const clientData = {
            name,
            email: email || null,
            phone,
            height: height || null,
            weight: weight || null,
            joiningDate,
            gender,
            aadhaar_number: aadhaar_number || null,
            address: address || null,
            planId: req.body.planId || null,
            gymId: req.user.gymId,
            addedBy: req.user.id
        };
        console.log('Creating client with data:', clientData);

        const client = await Client.create(clientData);
        res.json(client);
    } catch (error) {
        console.error('Error creating client:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- STAFF ROUTES (Admin) ---

app.post('/api/staff', authenticate, checkSubscriptionStatus, authorize(['admin']), async (req, res) => {
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

app.get('/api/staff', authenticate, checkSubscriptionStatus, authorize(['admin']), async (req, res) => {
    try {
        const staff = await User.findAll({ where: { gymId: req.user.gymId, role: 'trainer' } });
        res.json(staff);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// --- PLAN ROUTES (Admin) ---

app.post('/api/plans', authenticate, checkSubscriptionStatus, authorize(['admin']), async (req, res) => {
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

app.get('/api/plans', authenticate, checkSubscriptionStatus, authorize(['admin', 'trainer', 'superadmin']), async (req, res) => {
    try {
        const plans = await Plan.findAll({ where: { gymId: req.user.gymId } });
        res.json(plans);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- DASHBOARD ROUTE ---
app.get('/api/dashboard', authenticate, checkSubscriptionStatus, authorize(['admin', 'trainer', 'superadmin']), async (req, res) => {
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

app.post('/api/payments', authenticate, checkSubscriptionStatus, authorize(['admin', 'trainer']), async (req, res) => {
    try {
        const { clientId, amount, method, date } = req.body;
        const payment = await Payment.create({
            clientId,
            amount,
            method,
            date,
            gymId: req.user.gymId
        });

        // Activate client and set expiry
        const client = await Client.findByPk(clientId, { include: [Plan] });
        if (client) {
            client.status = 'active';

            // Calculate expiry based on plan duration
            if (client.Plan) {
                const durationMonths = client.Plan.duration;
                const paymentDate = new Date(date || new Date());
                const expiryDate = new Date(paymentDate);
                expiryDate.setMonth(expiryDate.getMonth() + durationMonths);
                client.planExpiresAt = expiryDate;
            }
            await client.save();
        }

        res.json(payment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update GET /api/clients to check expiry
app.get('/api/clients', authenticate, checkSubscriptionStatus, authorize(['admin', 'trainer', 'superadmin']), async (req, res) => {
    try {
        let where = {};
        if (req.user.role !== 'superadmin') {
            where.gymId = req.user.gymId;
        }

        // Fetch clients
        const clients = await Client.findAll({ where, include: [Plan] });

        // Check for expiry and update status if needed
        const now = new Date();
        const updatedClients = await Promise.all(clients.map(async (client) => {
            if (client.status === 'active' && client.planExpiresAt && new Date(client.planExpiresAt) < now) {
                client.status = 'payment_due';
                await client.save();
            }
            return client;
        }));

        res.json(updatedClients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/payments', authenticate, checkSubscriptionStatus, authorize(['admin', 'trainer']), async (req, res) => {
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

app.get('/api/reports', authenticate, checkSubscriptionStatus, authorize(['admin', 'superadmin']), async (req, res) => {
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

app.get('/api/attendance/today', authenticate, checkSubscriptionStatus, authorize(['admin', 'trainer', 'superadmin']), async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const where = { date: today };
        if (req.user.gymId) where.gymId = req.user.gymId;

        const attendance = await Attendance.findAll({
            where,
            include: [{ model: Client, attributes: ['id', 'name'] }]
        });
        res.json(attendance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/attendance/client/:clientId', authenticate, checkSubscriptionStatus, authorize(['admin', 'trainer', 'superadmin']), async (req, res) => {
    try {
        const { clientId } = req.params;
        const where = { clientId };
        if (req.user.gymId) where.gymId = req.user.gymId;

        const attendance = await Attendance.findAll({
            where,
            order: [['date', 'DESC']],
            include: [{ model: Client, attributes: ['id', 'name'] }]
        });
        res.json(attendance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/attendance', authenticate, checkSubscriptionStatus, authorize(['admin', 'trainer']), async (req, res) => {
    try {
        const { clientId, status } = req.body;
        const today = new Date().toISOString().split('T')[0];

        // Check if already checked in today
        const existing = await Attendance.findOne({
            where: { clientId, date: today, gymId: req.user.gymId }
        });

        if (existing) {
            return res.status(400).json({ message: 'Member already checked in for today' });
        }

        const attendance = await Attendance.create({
            clientId,
            gymId: req.user.gymId,
            date: today,
            status: status || 'present',
            checkInTime: new Date().toLocaleTimeString('en-US', { hour12: false })
        });

        res.json(attendance);
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

app.put('/api/clients/:id', authenticate, checkSubscriptionStatus, authorize(['admin', 'trainer']), async (req, res) => {
    try {
        const { name, email, phone, height, weight, joiningDate, gender, aadhaar_number, address } = req.body;
        const client = await Client.findOne({ where: { id: req.params.id, gymId: req.user.gymId } });

        if (!client) return res.status(404).json({ message: 'Client not found' });

        client.name = name;
        client.email = email;
        client.phone = phone;
        client.height = height;
        client.weight = weight;
        client.joiningDate = joiningDate;
        client.gender = gender;
        client.aadhaar_number = aadhaar_number;
        client.address = address;
        if (req.body.planId) client.planId = req.body.planId;
        await client.save();
        res.json(client);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/clients/:id', authenticate, checkSubscriptionStatus, authorize(['admin', 'trainer']), async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, gymId: req.user.gymId } });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        await client.destroy();
        res.json({ message: 'Client deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/staff/:id', authenticate, checkSubscriptionStatus, authorize(['admin']), async (req, res) => {
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

app.delete('/api/staff/:id', authenticate, checkSubscriptionStatus, authorize(['admin']), async (req, res) => {
    try {
        const staff = await User.findOne({ where: { id: req.params.id, gymId: req.user.gymId, role: 'trainer' } });
        if (!staff) return res.status(404).json({ message: 'Staff member not found' });
        await staff.destroy();
        res.json({ message: 'Staff deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/plans/:id', authenticate, checkSubscriptionStatus, authorize(['admin']), async (req, res) => {
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
sequelize.sync({ alter: true }).then(async () => {
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
