import 'dart:math' as math;

/// What the app calls itself.
///
/// This is not read from the server. The title used to come from the
/// snapshot's branding block, which meant the app wore whatever name the
/// backend happened to be serving — so a rename shipped in the APK did not
/// show until the site was redeployed, and an unreachable server left it on
/// a stale one. The app's own name is the app's own.
const kAppTitle = 'RR888BD';
const kAppSubtitle = 'ENCRYPTED SIGNAL TERMINAL';

enum SignalGame { aviator, crash }

/// Games the terminal will not open yet. Crash has an engine on the site but
/// its signal queue is not trusted enough to sell, so the tab shows locked
/// rather than being hidden — a player who knows it exists can see it is
/// coming. Drop it from this set to open it; nothing else changes.
const kLockedGames = {SignalGame.crash};

extension SignalGameLock on SignalGame {
  bool get locked => kLockedGames.contains(this);
}

extension SignalGameLabel on SignalGame {
  String get apiValue => switch (this) {
        SignalGame.aviator => 'aviator',
        SignalGame.crash => 'crash',
      };

  String get label => switch (this) {
        SignalGame.aviator => 'AVIATOR',
        SignalGame.crash => 'CRASH',
      };
}

SignalGame parseSignalGame(Object? value) {
  final raw = value?.toString().toLowerCase();
  return raw == 'crash' ? SignalGame.crash : SignalGame.aviator;
}

class StatIndicator {
  const StatIndicator({
    required this.value,
    required this.label,
  });

  final String value;
  final String label;
}

class SignalRound {
  const SignalRound({
    required this.multiplier,
    this.happenedAt,
  });

  final double multiplier;
  final DateTime? happenedAt;

  factory SignalRound.fromJson(Object? raw) {
    if (raw is num) {
      return SignalRound(multiplier: raw.toDouble());
    }

    if (raw is Map) {
      final map = Map<String, dynamic>.from(raw);
      return SignalRound(
        multiplier:
            _readDouble(map['multiplier'] ?? map['x'] ?? map['crashAt'], 1),
        happenedAt:
            DateTime.tryParse('${map['happenedAt'] ?? map['createdAt'] ?? ''}'),
      );
    }

    return const SignalRound(multiplier: 1);
  }
}

/// One entry in the queue of signals still to come.
///
/// `targetX` is null while the operator has signals switched off: the round
/// is real and its hash is committed, but the number is not given away yet.
class UpcomingSignal {
  const UpcomingSignal({
    required this.position,
    required this.roundId,
    required this.targetX,
    required this.flyAt,
    required this.flyInMs,
    required this.serverSeedHash,
    this.crashAt,
  });

  final int position;
  final int roundId;
  final double? targetX;
  final DateTime? flyAt;
  final int flyInMs;
  final String serverSeedHash;

  /// when the plane bursts, on the server's clock; null from a server
  /// older than 2026-09-12
  final DateTime? crashAt;

  bool get revealed => targetX != null;

  factory UpcomingSignal.fromJson(Object? raw, int index) {
    final map = _readMap(raw);
    final target = map['targetX'];
    return UpcomingSignal(
      position: _readCount(map['position'], index + 1),
      roundId: _readCount(map['roundId'], 0),
      targetX: target is num ? target.toDouble() : null,
      flyAt: DateTime.tryParse('${map['flyAt'] ?? ''}'),
      flyInMs: map['flyInMs'] is num ? (map['flyInMs'] as num).round() : 0,
      serverSeedHash: _readString(map['serverSeedHash'], ''),
      crashAt: DateTime.tryParse('${map['crashAt'] ?? ''}'),
    );
  }
}

class SignalSnapshot {
  const SignalSnapshot({
    required this.game,
    required this.title,
    required this.subtitle,
    required this.modeBadge,
    required this.accuracy,
    required this.mode,
    required this.winRate,
    required this.targetMultiplier,
    required this.timestamp,
    required this.signalActive,
    required this.signalLabel,
    required this.autoSignalActive,
    required this.recentRounds,
    required this.upcoming,
    required this.notice,
  });

  final SignalGame game;
  final String title;
  final String subtitle;
  final String modeBadge;
  final int accuracy;
  final String mode;
  final int winRate;
  final double targetMultiplier;
  final DateTime timestamp;
  final bool signalActive;
  final String signalLabel;
  final bool autoSignalActive;
  final List<SignalRound> recentRounds;
  final List<UpcomingSignal> upcoming;
  final String notice;

  SignalSnapshot copyWith({
    double? targetMultiplier,
    DateTime? timestamp,
    bool? signalActive,
    String? signalLabel,
    bool? autoSignalActive,
    String? notice,
  }) {
    return SignalSnapshot(
      game: game,
      title: title,
      subtitle: subtitle,
      modeBadge: modeBadge,
      accuracy: accuracy,
      mode: mode,
      winRate: winRate,
      targetMultiplier: targetMultiplier ?? this.targetMultiplier,
      timestamp: timestamp ?? this.timestamp,
      signalActive: signalActive ?? this.signalActive,
      signalLabel: signalLabel ?? this.signalLabel,
      autoSignalActive: autoSignalActive ?? this.autoSignalActive,
      recentRounds: recentRounds,
      upcoming: upcoming,
      notice: notice ?? this.notice,
    );
  }

  List<StatIndicator> get stats => [
        StatIndicator(value: '$accuracy%', label: 'ACCURACY'),
        StatIndicator(value: mode, label: 'MODE'),
        StatIndicator(value: '$winRate%', label: 'WIN RATE'),
      ];

  factory SignalSnapshot.fromJson(
      Map<String, dynamic> json, SignalGame fallbackGame) {
    final branding = _readMap(json['branding']);
    final stats = _readMap(json['stats']);
    final signal = _readMap(json['signal']);
    final rounds = (json['recentRounds'] as List? ?? const [])
        .map(SignalRound.fromJson)
        .where((round) => round.multiplier >= 1)
        .toList(growable: false);

    final upcomingRaw = json['upcoming'] as List? ?? const [];
    final upcoming = <UpcomingSignal>[
      for (var i = 0; i < upcomingRaw.length; i++)
        UpcomingSignal.fromJson(upcomingRaw[i], i),
    ];

    return SignalSnapshot(
      game: parseSignalGame(json['game'] ?? fallbackGame.apiValue),
      title: kAppTitle,
      subtitle: kAppSubtitle,
      modeBadge: _readString(branding['modeBadge'], 'MODE: BASS'),
      accuracy: _readInt(stats['accuracy'], 60),
      mode: _readString(stats['mode'], 'AUTO').toUpperCase(),
      winRate: _readInt(stats['winRate'], 80),
      targetMultiplier: _readDouble(
        json['targetMultiplier'] ?? json['target'] ?? json['multiplier'],
        60.17,
      ),
      timestamp:
          DateTime.tryParse('${json['timestamp'] ?? ''}') ?? DateTime.now(),
      signalActive: _readBool(signal['active'], true),
      signalLabel: _readString(signal['label'], 'SIGNAL ACTIVE').toUpperCase(),
      autoSignalActive: _readBool(signal['auto'], true),
      recentRounds: rounds.isEmpty ? _demoRounds(DateTime.now(), 0) : rounds,
      upcoming: upcoming,
      notice: _readString(json['notice'], 'এক্সেস গ্রান্টেড'),
    );
  }

  factory SignalSnapshot.demo(
    SignalGame game, {
    DateTime? now,
    bool offline = false,
  }) {
    final time = now ?? DateTime.now();
    final seed =
        (time.millisecondsSinceEpoch ~/ Duration.millisecondsPerMinute) +
            (game == SignalGame.crash ? 5 : 0);
    final targets = game == SignalGame.aviator
        ? const [60.17, 3.82, 2.46, 8.71, 1.92, 12.34]
        : const [7.48, 2.16, 4.08, 1.64, 9.22, 3.35];
    final target = targets[seed % targets.length];
    final mode = seed.isEven ? 'AUTO' : 'BASS';

    return SignalSnapshot(
      game: game,
      title: kAppTitle,
      subtitle: kAppSubtitle,
      modeBadge: 'MODE: $mode',
      accuracy: 60 + seed % 9,
      mode: mode,
      winRate: 78 + seed % 7,
      targetMultiplier: target,
      timestamp: time,
      signalActive: !offline,
      signalLabel: offline ? 'DEMO SIGNAL' : 'SIGNAL ACTIVE',
      autoSignalActive: true,
      recentRounds: _demoRounds(time, seed),
      upcoming: _demoUpcoming(time, seed, targets, offline),
      notice: offline ? 'ডেমো ডাটা চালু' : 'এক্সেস গ্রান্টেড',
    );
  }
}

List<UpcomingSignal> _demoUpcoming(
  DateTime now,
  int seed,
  List<double> targets,
  bool offline,
) {
  return List.generate(5, (index) {
    final at = now.add(Duration(seconds: 45 * (index + 1)));
    return UpcomingSignal(
      position: index + 1,
      roundId: seed + index + 1,
      targetX: offline ? null : targets[(seed + index) % targets.length],
      flyAt: at,
      flyInMs: at.difference(now).inMilliseconds,
      serverSeedHash: '',
    );
  });
}

List<SignalRound> _demoRounds(DateTime now, int seed) {
  const values = [3.03, 2.38, 1.83, 2.64, 3.02, 2.18, 6.44, 1.21];
  final offset = seed % values.length;

  return List.generate(values.length, (index) {
    return SignalRound(
      multiplier: values[(index + offset) % values.length],
      happenedAt: now.subtract(Duration(minutes: index + 1)),
    );
  });
}

Map<String, dynamic> _readMap(Object? value) {
  if (value is Map) return Map<String, dynamic>.from(value);
  return const {};
}

String _readString(Object? value, String fallback) {
  final raw = value?.toString().trim();
  return raw == null || raw.isEmpty ? fallback : raw;
}

/// Percentages — accuracy, win rate — which are the only things this was
/// ever meant to read, hence the clamp.
int _readInt(Object? value, int fallback) {
  if (value is num) return value.round().clamp(0, 100).toInt();
  return int.tryParse('${value ?? ''}')?.clamp(0, 100).toInt() ?? fallback;
}

/// A plain counter. Round ids run past 100 within a day, and reading them
/// through _readInt capped every one of them at 100.
int _readCount(Object? value, int fallback) {
  if (value is num) return value.round();
  return int.tryParse('${value ?? ''}') ?? fallback;
}

double _readDouble(Object? value, double fallback) {
  if (value is num) return math.max(1.0, value.toDouble());
  return math.max(1.0, double.tryParse('${value ?? ''}') ?? fallback);
}

bool _readBool(Object? value, bool fallback) {
  if (value is bool) return value;
  final raw = value?.toString().toLowerCase();
  if (raw == 'true' || raw == '1' || raw == 'yes') return true;
  if (raw == 'false' || raw == '0' || raw == 'no') return false;
  return fallback;
}
