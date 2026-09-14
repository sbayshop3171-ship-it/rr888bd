import 'package:flutter/material.dart';

import '../models/signal_snapshot.dart';
import '../theme/neon_theme.dart';

/// The next round's signal, and how long until it flies.
///
/// It was a ladder of the next five; the operator wants one (2026-09-11) —
/// the round about to be played, shown a little before it takes off. The
/// server sends only that one now, and this takes the first either way. A
/// round whose number is not revealed yet still shows, without the number.
class NextSignalsList extends StatelessWidget {
  const NextSignalsList({
    super.key,
    required this.signals,
    required this.now,
    this.revealed = true,
    this.burstX,
    this.scale = 1,
  });

  /// false until the reveal lead — the row waits, without its number
  final bool revealed;

  /// set while the plane has just burst: the row shows that number in red
  final double? burstX;
  final List<UpcomingSignal> signals;
  final DateTime now;
  final double scale;

  @override
  Widget build(BuildContext context) {
    if (signals.isEmpty) return const SizedBox.shrink();
    final signal = signals.first;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: EdgeInsets.only(left: 3 * scale, bottom: 8 * scale),
          child: Row(
            children: [
              Text(
                'NEXT SIGNAL',
                style: TextStyle(
                  color: NeonPalette.muted,
                  fontSize: 10 * scale,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.2,
                ),
              ),
              const Spacer(),
              Text(
                'ROUND #${signal.roundId}',
                style: TextStyle(
                  color: NeonPalette.cyanSoft,
                  fontSize: 9 * scale,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1,
                ),
              ),
            ],
          ),
        ),
        _SignalRow(signal: signal, lead: true, now: now, scale: scale, revealed: revealed, burstX: burstX),
      ],
    );
  }
}

class _SignalRow extends StatelessWidget {
  const _SignalRow({
    required this.signal,
    required this.lead,
    required this.now,
    required this.scale,
    this.revealed = true,
    this.burstX,
  });

  final UpcomingSignal signal;
  final bool revealed;
  final double? burstX;
  final bool lead;
  final DateTime now;
  final double scale;

  @override
  Widget build(BuildContext context) {
    final target = burstX ?? (revealed ? signal.targetX : null);
    final colour = burstX != null
        ? NeonPalette.red
        : target == null ? NeonPalette.cyanSoft : _colourFor(target);
    // the row fades back down the queue, so the eye lands on the next one
    final depth = lead ? 1.0 : (1 - (signal.position - 1) * 0.13).clamp(0.5, 1.0);

    return Opacity(
      opacity: depth,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: 12 * scale,
          vertical: (lead ? 13 : 10) * scale,
        ),
        decoration: BoxDecoration(
          color: colour.withOpacity(lead ? 0.14 : 0.07),
          borderRadius: BorderRadius.circular(10 * scale),
          border: Border.all(
            color: colour.withOpacity(lead ? 0.6 : 0.28),
            width: lead ? 1.4 : 1,
          ),
          boxShadow: lead
              ? [
                  BoxShadow(
                    color: colour.withOpacity(0.25),
                    blurRadius: 16 * scale,
                  ),
                ]
              : null,
        ),
        child: Row(
          children: [
            _Position(position: signal.position, colour: colour, scale: scale),
            SizedBox(width: 11 * scale),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    lead ? 'NEXT ROUND' : 'ROUND #${signal.roundId}',
                    style: TextStyle(
                      color: NeonPalette.muted,
                      fontSize: 9 * scale,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1,
                    ),
                  ),
                  SizedBox(height: 3 * scale),
                  Text(
                    burstX != null ? 'ফেটে গেছে' : _status(signal, now, revealed),
                    style: TextStyle(
                      color: NeonPalette.text.withOpacity(0.8),
                      fontSize: 11 * scale,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              target == null ? '— —' : '${target.toStringAsFixed(2)}x',
              style: TextStyle(
                color: colour,
                fontSize: (lead ? 26 : 19) * scale,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Position extends StatelessWidget {
  const _Position({
    required this.position,
    required this.colour,
    required this.scale,
  });

  final int position;
  final Color colour;
  final double scale;

  @override
  Widget build(BuildContext context) {
    final size = 26 * scale;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: colour.withOpacity(0.18),
        shape: BoxShape.circle,
        border: Border.all(color: colour.withOpacity(0.5)),
      ),
      child: Text(
        '$position',
        style: TextStyle(
          color: colour,
          fontSize: 12 * scale,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

/// What the row says under NEXT ROUND. No seconds — the operator asked for
/// the count to go (2026-09-12): the number alone is the signal. `now` is on
/// the server's clock, so a phone set wrong does not matter.
String _status(UpcomingSignal signal, DateTime now, bool revealed) {
  final flyAt = signal.flyAt;
  final ms = flyAt != null
      ? flyAt.difference(now).inMilliseconds
      : signal.flyInMs;
  if (ms <= 0) return 'উড়ছে এখনই';
  return revealed ? 'এই রাউন্ডে উড়বে' : 'সিগন্যাল আসছে…';
}

/// Red is kept for the burst alone, so a low signal is never read as a
/// plane that has already gone.
Color _colourFor(double value) {
  if (value < 2) return NeonPalette.green;
  if (value < 3) return NeonPalette.cyan;
  if (value < 10) return NeonPalette.mint;
  return NeonPalette.gold;
}
