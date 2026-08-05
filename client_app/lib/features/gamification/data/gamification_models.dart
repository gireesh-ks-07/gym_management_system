// Lightweight typed models for the member gamification API
// (GET /client/gamification/*). Kept thin — tolerant of missing fields.

int _int(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? (v is double ? v.toInt() : 0));
String _str(dynamic v) => v?.toString() ?? '';

class LeagueInfo {
  final String name;
  final int tier;
  final String color;
  const LeagueInfo({required this.name, required this.tier, required this.color});
  static LeagueInfo? from(dynamic j) {
    if (j == null) return null;
    final m = Map<String, dynamic>.from(j);
    return LeagueInfo(name: _str(m['name']), tier: _int(m['tier']), color: _str(m['color']).isEmpty ? '#CD7F32' : _str(m['color']));
  }
}

class LevelProgress {
  final int level;
  final int xpIntoLevel;
  final int nextLevelXp;
  final int xpForNextLevel;
  final int percent;
  const LevelProgress({required this.level, required this.xpIntoLevel, required this.nextLevelXp, required this.xpForNextLevel, required this.percent});
  factory LevelProgress.fromJson(Map<String, dynamic> j) => LevelProgress(
        level: _int(j['level']),
        xpIntoLevel: _int(j['xpIntoLevel']),
        nextLevelXp: _int(j['nextLevelXp']),
        xpForNextLevel: _int(j['xpForNextLevel']),
        percent: _int(j['percent']),
      );
}

class GamiSummary {
  final int level;
  final String title;
  final int totalXp;
  final int lifetimeXp;
  final int weeklyXp;
  final int? weeklyRank;
  final LeagueInfo? league;
  final int currentStreak;
  final int longestStreak;
  final LevelProgress progress;
  final String? nextRewardName;
  final int? nextRewardCost;

  const GamiSummary({
    required this.level,
    required this.title,
    required this.totalXp,
    required this.lifetimeXp,
    required this.weeklyXp,
    required this.weeklyRank,
    required this.league,
    required this.currentStreak,
    required this.longestStreak,
    required this.progress,
    required this.nextRewardName,
    required this.nextRewardCost,
  });

  factory GamiSummary.fromJson(Map<String, dynamic> j) => GamiSummary(
        level: _int(j['level']),
        title: _str(j['title']),
        totalXp: _int(j['totalXp']),
        lifetimeXp: _int(j['lifetimeXp']),
        weeklyXp: _int(j['weeklyXp']),
        weeklyRank: j['weeklyRank'] == null ? null : _int(j['weeklyRank']),
        league: LeagueInfo.from(j['league']),
        currentStreak: _int(j['currentStreak']),
        longestStreak: _int(j['longestStreak']),
        progress: LevelProgress.fromJson(Map<String, dynamic>.from(j['progress'] ?? {})),
        nextRewardName: j['nextReward'] == null ? null : _str(j['nextReward']['name']),
        nextRewardCost: j['nextReward'] == null ? null : _int(j['nextReward']['xpCost']),
      );
}

class DailyGoal {
  final String key;
  final String label;
  final String icon;
  final int xp;
  final bool completed;
  const DailyGoal({required this.key, required this.label, required this.icon, required this.xp, required this.completed});
  factory DailyGoal.fromJson(Map<String, dynamic> j) => DailyGoal(
        key: _str(j['key']), label: _str(j['label']), icon: _str(j['icon']), xp: _int(j['xp']), completed: j['completed'] == true);
}

class XpBreakdownItem {
  final String label;
  final int xp;
  const XpBreakdownItem({required this.label, required this.xp});
}

class XpToday {
  final int total;
  final List<XpBreakdownItem> breakdown;
  const XpToday({required this.total, required this.breakdown});
  factory XpToday.fromJson(Map<String, dynamic> j) => XpToday(
        total: _int(j['total']),
        breakdown: ((j['breakdown'] ?? []) as List)
            .map((e) => XpBreakdownItem(label: _str(e['label']), xp: _int(e['xp'])))
            .toList(),
      );
}

class LeaderEntry {
  final int rank;
  final int clientId;
  final String name;
  final int xp;
  final int level;
  final int currentStreak;
  final LeagueInfo? league;
  final bool isCurrentUser;
  const LeaderEntry({
    required this.rank, required this.clientId, required this.name, required this.xp,
    required this.level, required this.currentStreak, required this.league, required this.isCurrentUser});
  factory LeaderEntry.fromJson(Map<String, dynamic> j) => LeaderEntry(
        rank: _int(j['rank']), clientId: _int(j['clientId']), name: _str(j['name']), xp: _int(j['xp']),
        level: _int(j['level']), currentStreak: _int(j['currentStreak']), league: LeagueInfo.from(j['league']),
        isCurrentUser: j['isCurrentUser'] == true);
}

class LeagueStanding {
  final LeagueInfo? league;
  final int? myRank;
  final int promotionZone;
  final int relegationZone;
  final List<LeaderEntry> standings;
  const LeagueStanding({required this.league, required this.myRank, required this.promotionZone, required this.relegationZone, required this.standings});
  factory LeagueStanding.fromJson(Map<String, dynamic> j) => LeagueStanding(
        league: LeagueInfo.from(j['league']),
        myRank: j['myRank'] == null ? null : _int(j['myRank']),
        promotionZone: _int(j['promotionZone']),
        relegationZone: _int(j['relegationZone']),
        standings: ((j['standings'] ?? []) as List).map((e) => LeaderEntry(
              rank: _int(e['rank']), clientId: _int(e['clientId']), name: _str(e['name']), xp: _int(e['weeklyXp']),
              level: 0, currentStreak: 0, league: null, isCurrentUser: e['isCurrentUser'] == true)).toList(),
      );
}

class ChallengeItem {
  final int id;
  final String title;
  final String description;
  final String type;
  final int xpReward;
  final String difficulty;
  final int target;
  final int progress;
  final int percent;
  final bool completed;
  final bool claimed;
  const ChallengeItem({
    required this.id, required this.title, required this.description, required this.type, required this.xpReward,
    required this.difficulty, required this.target, required this.progress, required this.percent, required this.completed, required this.claimed});
  factory ChallengeItem.fromJson(Map<String, dynamic> j) => ChallengeItem(
        id: _int(j['id']), title: _str(j['title']), description: _str(j['description']), type: _str(j['type']),
        xpReward: _int(j['xpReward']), difficulty: _str(j['difficulty']), target: _int(j['target']),
        progress: _int(j['progress']), percent: _int(j['percent']), completed: j['completed'] == true, claimed: j['claimed'] == true);
}

class AchievementItem {
  final int id;
  final String name;
  final String icon;
  final String category;
  final int rewardXp;
  final bool unlocked;
  const AchievementItem({required this.id, required this.name, required this.icon, required this.category, required this.rewardXp, required this.unlocked});
  factory AchievementItem.fromJson(Map<String, dynamic> j) => AchievementItem(
        id: _int(j['id']), name: _str(j['name']), icon: _str(j['icon']), category: _str(j['category']),
        rewardXp: _int(j['rewardXp']), unlocked: j['unlocked'] == true);
}

class StreakDay {
  final String date;
  final int xp;
  const StreakDay({required this.date, required this.xp});
}

class StreakData {
  final int currentStreak;
  final int longestStreak;
  final int? nextMilestone;
  final int? daysToMilestone;
  final List<StreakDay> heatmap;
  const StreakData({required this.currentStreak, required this.longestStreak, required this.nextMilestone, required this.daysToMilestone, required this.heatmap});
  factory StreakData.fromJson(Map<String, dynamic> j) => StreakData(
        currentStreak: _int(j['currentStreak']), longestStreak: _int(j['longestStreak']),
        nextMilestone: j['nextMilestone'] == null ? null : _int(j['nextMilestone']),
        daysToMilestone: j['daysToMilestone'] == null ? null : _int(j['daysToMilestone']),
        heatmap: ((j['heatmap'] ?? []) as List).map((e) => StreakDay(date: _str(e['date']), xp: _int(e['xp']))).toList(),
      );
}

class RewardItem {
  final int id;
  final String name;
  final String description;
  final String image;
  final int xpCost;
  final bool available;
  final bool affordable;
  const RewardItem({required this.id, required this.name, required this.description, required this.image, required this.xpCost, required this.available, required this.affordable});
  factory RewardItem.fromJson(Map<String, dynamic> j) => RewardItem(
        id: _int(j['id']), name: _str(j['name']), description: _str(j['description']), image: _str(j['image']),
        xpCost: _int(j['xpCost']), available: j['available'] == true, affordable: j['affordable'] == true);
}

class RewardStore {
  final int balance;
  final List<RewardItem> rewards;
  const RewardStore({required this.balance, required this.rewards});
  factory RewardStore.fromJson(Map<String, dynamic> j) => RewardStore(
        balance: _int(j['balance']),
        rewards: ((j['rewards'] ?? []) as List).map((e) => RewardItem.fromJson(Map<String, dynamic>.from(e))).toList());
}

class TimelineEvent {
  final String type;
  final String title;
  final String description;
  final int xp;
  final String icon;
  final DateTime createdAt;
  const TimelineEvent({required this.type, required this.title, required this.description, required this.xp, required this.icon, required this.createdAt});
  factory TimelineEvent.fromJson(Map<String, dynamic> j) => TimelineEvent(
        type: _str(j['type']), title: _str(j['title']), description: _str(j['description']), xp: _int(j['xp']),
        icon: _str(j['icon']), createdAt: DateTime.tryParse(_str(j['createdAt'])) ?? DateTime.now());
}
