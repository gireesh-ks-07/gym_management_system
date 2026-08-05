// =============================================================================
// Gamification default configuration (seeded as global rows, facilityId = null)
// Admins can override per-facility via the XP / League / Achievement management
// endpoints. Changing a value here only affects fresh seeds.
// =============================================================================

// ---- XP rules (from the product spec) --------------------------------------
// code -> used as the stable identifier the engine & hooks reference.
const DEFAULT_XP_RULES = [
    { code: 'daily_checkin', label: 'Daily Check-in', xp: 20, category: 'engagement', frequency: 'once_per_day' },
    { code: 'gym_attendance', label: 'Gym Attendance', xp: 25, category: 'attendance', frequency: 'once_per_day' },
    { code: 'workout_completed', label: 'Workout Completed', xp: 100, category: 'workout', frequency: 'once_per_day' },
    { code: 'workout_long', label: 'Workout Over 60 Minutes', xp: 25, category: 'workout', frequency: 'once_per_day' },
    { code: 'cardio_completed', label: 'Cardio Completed', xp: 20, category: 'workout', frequency: 'once_per_day' },
    { code: 'nutrition_logged', label: 'Nutrition Logged', xp: 20, category: 'nutrition', frequency: 'once_per_day' },
    { code: 'weight_updated', label: 'Weight Updated', xp: 10, category: 'health', frequency: 'once_per_day' },
    { code: 'measurements_updated', label: 'Body Measurements Updated', xp: 10, category: 'health', frequency: 'once_per_day' },
    { code: 'progress_photo', label: 'Progress Photo Uploaded', xp: 20, category: 'health', frequency: 'once_per_day' },
    { code: 'trainer_feedback', label: 'Trainer Feedback', xp: 30, category: 'community', frequency: 'unlimited' },
    { code: 'referral', label: 'Referral', xp: 250, category: 'community', frequency: 'unlimited' },
    { code: 'payment_on_time', label: 'Payment On Time', xp: 40, category: 'milestones', frequency: 'unlimited' },
    { code: 'daily_challenge', label: 'Complete Daily Challenge', xp: 50, category: 'challenge', frequency: 'unlimited' },
    { code: 'weekly_challenge', label: 'Complete Weekly Challenge', xp: 150, category: 'challenge', frequency: 'unlimited' },
    { code: 'streak_7', label: '7 Day Streak', xp: 100, category: 'consistency', frequency: 'unlimited' },
    { code: 'streak_30', label: '30 Day Streak', xp: 500, category: 'consistency', frequency: 'unlimited' },
    { code: 'birthday_workout', label: 'Birthday Workout', xp: 100, category: 'special', frequency: 'unlimited' },
    { code: 'transformation_milestone', label: 'Transformation Milestone', xp: 500, category: 'milestones', frequency: 'unlimited' },
    { code: 'personal_record', label: 'New Personal Record', xp: 40, category: 'strength', frequency: 'unlimited' },
    // Not real events yet — used by manual adjustments / future hooks.
    { code: 'manual_adjust', label: 'Manual Adjustment', xp: 0, category: 'admin', frequency: 'unlimited' }
];

// ---- Leagues Bronze -> Legend ----------------------------------------------
const DEFAULT_LEAGUES = [
    { tier: 1, name: 'Bronze', icon: 'Shield', color: '#CD7F32' },
    { tier: 2, name: 'Silver', icon: 'Shield', color: '#C0C0C0' },
    { tier: 3, name: 'Gold', icon: 'Shield', color: '#FFD700' },
    { tier: 4, name: 'Platinum', icon: 'Gem', color: '#E5E4E2' },
    { tier: 5, name: 'Diamond', icon: 'Gem', color: '#B9F2FF' },
    { tier: 6, name: 'Elite', icon: 'Star', color: '#7C3AED' },
    { tier: 7, name: 'Champion', icon: 'Crown', color: '#F97316' },
    { tier: 8, name: 'Master', icon: 'Crown', color: '#EF4444' },
    { tier: 9, name: 'Legend', icon: 'Trophy', color: '#10B981' }
].map((l) => ({
    ...l,
    promotionCount: 5,
    relegationCount: l.tier === 1 ? 0 : 5,
    capacity: 30,
    rewardXp: l.tier * 50,
    autoPromotion: true
}));

// ---- Starter achievements --------------------------------------------------
// metric names must match those produced by engine.getMemberStats().
const DEFAULT_ACHIEVEMENTS = [
    { code: 'first_workout', name: 'First Workout', icon: 'Dumbbell', category: 'workout', rewardXp: 50, unlockCondition: { metric: 'workouts_completed', gte: 1 } },
    { code: 'streak_7', name: '7 Day Streak', icon: 'Flame', category: 'consistency', rewardXp: 100, unlockCondition: { metric: 'longest_streak', gte: 7 } },
    { code: 'streak_30', name: '30 Day Streak', icon: 'Flame', category: 'consistency', rewardXp: 250, unlockCondition: { metric: 'longest_streak', gte: 30 } },
    { code: 'checkins_100', name: '100 Check-ins', icon: 'CalendarCheck', category: 'attendance', rewardXp: 200, unlockCondition: { metric: 'attendance_count', gte: 100 } },
    { code: 'early_bird', name: 'Early Bird', icon: 'Sunrise', category: 'special', rewardXp: 75, unlockCondition: { metric: 'early_checkins', gte: 10 } },
    { code: 'iron_warrior', name: 'Iron Warrior', icon: 'Dumbbell', category: 'strength', rewardXp: 150, unlockCondition: { metric: 'workouts_completed', gte: 50 } },
    { code: 'nutrition_hero', name: 'Nutrition Hero', icon: 'Apple', category: 'nutrition', rewardXp: 150, unlockCondition: { metric: 'nutrition_logs', gte: 30 } },
    { code: 'fitness_champion', name: 'Fitness Champion', icon: 'Trophy', category: 'milestones', rewardXp: 300, unlockCondition: { metric: 'level', gte: 10 } },
    { code: 'xp_10k', name: 'XP Collector', icon: 'Zap', category: 'milestones', rewardXp: 250, unlockCondition: { metric: 'total_xp', gte: 10000 } }
];

// ---- Daily challenge templates (cron picks one/some each day) ---------------
const DAILY_CHALLENGE_TEMPLATES = [
    { title: 'Complete a Workout', description: 'Finish any workout session today.', xpReward: 50, difficulty: 'easy', criteria: { metric: 'workout_completed', target: 1 } },
    { title: 'Check In Today', description: 'Check in at the gym.', xpReward: 30, difficulty: 'easy', criteria: { metric: 'gym_attendance', target: 1 } },
    { title: 'Log Your Nutrition', description: 'Log a nutrition entry today.', xpReward: 40, difficulty: 'medium', criteria: { metric: 'nutrition_logged', target: 1 } },
    { title: 'Cardio Burn', description: 'Complete a cardio session.', xpReward: 40, difficulty: 'medium', criteria: { metric: 'cardio_completed', target: 1 } }
];

const WEEKLY_CHALLENGE_TEMPLATES = [
    { title: 'Attend 5 Times', description: 'Check in to the gym 5 times this week.', xpReward: 150, difficulty: 'medium', criteria: { metric: 'gym_attendance', target: 5 } },
    { title: 'Workout Warrior', description: 'Complete 4 workouts this week.', xpReward: 150, difficulty: 'hard', criteria: { metric: 'workout_completed', target: 4 } }
];

// Which XP rule codes count toward keeping a daily streak alive.
const STREAK_QUALIFYING_RULES = ['gym_attendance', 'daily_checkin', 'workout_completed'];

module.exports = {
    DEFAULT_XP_RULES,
    DEFAULT_LEAGUES,
    DEFAULT_ACHIEVEMENTS,
    DAILY_CHALLENGE_TEMPLATES,
    WEEKLY_CHALLENGE_TEMPLATES,
    STREAK_QUALIFYING_RULES
};
