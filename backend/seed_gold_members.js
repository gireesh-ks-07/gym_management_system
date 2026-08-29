/**
 * Seed ~22 realistic members into Gold Gym (facilityId 4) with:
 *  - an active membership plan + status/expiry dates
 *  - one or more PAID payment records (initial + renewals)
 *  - an active diet-plan assignment
 *  - check-in (attendance) history over the last ~6 weeks
 *
 * Idempotent: members are matched by name within the facility and skipped if
 * they already exist. Safe to re-run. DEV data only.
 *
 *   node seed_gold_members.js
 */
const m = require('./models');
const {
    sequelize, Client, Facility, Plan, Payment, Attendance,
    DietPlan, MemberDietAssignment,
} = m;

const FACILITY_ID = 4;      // Gold Gym
const ADMIN_USER_ID = 3;    // admin@goldgym.com
const MEMBER_PASSWORD = 'Member@1234';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pad = (n, w = 4) => String(n).padStart(w, '0');
const ymd = (d) => d.toISOString().split('T')[0];
const addMonths = (d, months) => { const x = new Date(d); x.setMonth(x.getMonth() + months); return x; };
const addDays = (d, days) => { const x = new Date(d); x.setDate(x.getDate() + days); return x; };

const MALE = [
    ['Aarav', 'Sharma'], ['Vivaan', 'Reddy'], ['Aditya', 'Nair'], ['Rohan', 'Gupta'],
    ['Arjun', 'Mehta'], ['Karthik', 'Iyer'], ['Rahul', 'Verma'], ['Siddharth', 'Rao'],
    ['Nikhil', 'Kulkarni'], ['Aman', 'Khanna'], ['Vikram', 'Singh'], ['Yash', 'Patel'],
];
const FEMALE = [
    ['Ananya', 'Sharma'], ['Diya', 'Menon'], ['Isha', 'Kapoor'], ['Sneha', 'Nair'],
    ['Priya', 'Desai'], ['Meera', 'Joshi'], ['Kavya', 'Reddy'], ['Riya', 'Malhotra'],
    ['Pooja', 'Iyer'], ['Neha', 'Bansal'],
];

async function ensurePlans() {
    const wanted = [
        { name: 'Basic', price: 1000, duration: 1 },
        { name: 'Quarterly', price: 2700, duration: 3 },
        { name: 'Half-Yearly', price: 5000, duration: 6 },
        { name: 'Annual', price: 9000, duration: 12 },
    ];
    const plans = [];
    for (const w of wanted) {
        let p = await Plan.findOne({ where: { facilityId: FACILITY_ID, name: w.name } });
        if (!p) p = await Plan.create({ ...w, facilityId: FACILITY_ID, description: `${w.name} membership`, features: [] });
        plans.push(p);
    }
    return plans;
}

async function ensureDietPlans() {
    const wanted = [
        { name: 'Weight Loss', goalType: 'weight_loss', durationWeeks: 4, targetCalories: 1800, protein: 130, carbs: 160, fat: 55, waterGoal: 3000 },
        { name: 'Lean Muscle Builder', goalType: 'muscle_gain', durationWeeks: 8, targetCalories: 2600, protein: 180, carbs: 280, fat: 70, waterGoal: 3500 },
        { name: 'Balanced Maintenance', goalType: 'maintenance', durationWeeks: 6, targetCalories: 2200, protein: 140, carbs: 220, fat: 65, waterGoal: 3000 },
    ];
    const dps = [];
    for (const w of wanted) {
        let p = await DietPlan.findOne({ where: { facilityId: FACILITY_ID, name: w.name } });
        if (!p) p = await DietPlan.create({ ...w, facilityId: FACILITY_ID, description: `${w.name} plan` });
        dps.push(p);
    }
    return dps;
}

async function nextPhone() {
    // Unique 10-digit phone starting 98…; find the first free one.
    for (let i = 1; i < 999; i++) {
        const phone = '98' + pad(100000 + i, 8);
        const exists = await Client.findOne({ where: { phone } });
        if (!exists) return phone;
    }
    throw new Error('no free phone');
}

function attendanceRows(clientId, joining) {
    // Generate check-ins across the last 42 days (only after joining).
    const rows = [];
    const today = new Date();
    const consistency = randInt(45, 85) / 100; // this member's turn-up rate
    for (let back = 41; back >= 0; back--) {
        const day = addDays(today, -back);
        if (day < joining) continue;
        const dow = day.getDay(); // 0 Sun … 6 Sat
        if (dow === 0) continue;  // gym rest day Sunday-ish
        if (Math.random() > consistency) continue;
        const morning = Math.random() < 0.6;
        const hh = morning ? randInt(6, 9) : randInt(17, 20);
        const mm = randInt(0, 59);
        const status = Math.random() < 0.92 ? 'present' : 'excused';
        rows.push({
            clientId,
            facilityId: FACILITY_ID,
            date: ymd(day),
            status,
            checkInTime: `${pad(hh, 2)}:${pad(mm, 2)}:00`,
        });
    }
    return rows;
}

async function run() {
    await sequelize.authenticate();
    const fac = await Facility.findByPk(FACILITY_ID);
    if (!fac) throw new Error('Gold Gym facility not found');

    const plans = await ensurePlans();
    const dietPlans = await ensureDietPlans();

    const roster = [
        ...MALE.map((n) => ({ first: n[0], last: n[1], gender: 'male' })),
        ...FEMALE.map((n) => ({ first: n[0], last: n[1], gender: 'female' })),
    ];

    let created = 0, skipped = 0, payments = 0, assigns = 0, checkins = 0;
    let invoiceSeq = Date.now() % 100000;

    for (const r of roster) {
        const name = `${r.first} ${r.last}`;
        const existing = await Client.findOne({ where: { facilityId: FACILITY_ID, name } });
        if (existing) { skipped++; continue; }

        const plan = pick(plans);
        const joining = addDays(new Date(), -randInt(20, 320));
        const height = r.gender === 'male' ? randInt(165, 186) : randInt(150, 171);
        const weight = r.gender === 'male' ? randInt(60, 92) : randInt(48, 74);
        const phone = await nextPhone();
        const email = `${r.first}.${r.last}${randInt(10, 99)}@goldgym.test`.toLowerCase();

        const client = await Client.create({
            name,
            email,
            phone,
            password: MEMBER_PASSWORD,
            gender: r.gender,
            height,
            weight,
            joiningDate: ymd(joining),
            status: 'active',
            planId: plan.id,
            facilityId: FACILITY_ID,
            addedBy: ADMIN_USER_ID,
            billingRenewalDate: ymd(addMonths(joining, plan.duration)),
            planExpiresAt: addMonths(joining, plan.duration),
            healthProfile: { goalType: pick(['weight_loss', 'muscle_gain', 'maintenance']), currentWeight: weight, height },
        });
        created++;

        // Payments: initial + a renewal for every full plan-duration elapsed.
        let payDate = new Date(joining);
        let lastPayDate = new Date(joining);
        const now = new Date();
        while (payDate <= now) {
            await Payment.create({
                amount: plan.price,
                method: Math.random() < 0.5 ? 'cash' : 'upi',
                date: ymd(payDate),
                transactionId: Math.random() < 0.5 ? null : 'TXN' + randInt(100000, 999999),
                invoiceNumber: `INV-GG-${pad(invoiceSeq++, 5)}`,
                planId: plan.id,
                clientId: client.id,
                facilityId: FACILITY_ID,
                processedBy: ADMIN_USER_ID,
            });
            payments++;
            lastPayDate = new Date(payDate);
            payDate = addMonths(payDate, plan.duration);
        }
        // Keep membership current: expiry follows the latest payment so paid members read Active.
        const expires = addMonths(lastPayDate, plan.duration);
        client.planExpiresAt = expires;
        client.billingRenewalDate = ymd(expires);
        await client.save();

        // Active diet-plan assignment.
        const dp = pick(dietPlans);
        await MemberDietAssignment.create({
            clientId: client.id,
            dietPlanId: dp.id,
            startDate: ymd(joining < addDays(new Date(), -dp.durationWeeks * 7) ? addDays(new Date(), -randInt(3, 20)) : joining),
            endDate: ymd(addDays(new Date(), dp.durationWeeks * 7 - randInt(0, 10))),
            status: 'active',
        });
        assigns++;

        // Check-ins.
        const rows = attendanceRows(client.id, joining);
        if (rows.length) { await Attendance.bulkCreate(rows); checkins += rows.length; }

        console.log(`✓ ${name.padEnd(20)} ${r.gender.padEnd(6)} plan=${plan.name.padEnd(11)} diet=${dp.name.padEnd(20)} checkins=${rows.length}`);
    }

    console.log(`\nDone. members created=${created}, skipped(existing)=${skipped}, payments=${payments}, dietAssignments=${assigns}, checkins=${checkins}`);
    console.log(`Login for any seeded member: phone above / password ${MEMBER_PASSWORD}`);
    await sequelize.close();
}

run().catch((e) => { console.error('SEED FAILED:', e); process.exit(1); });
