import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/neon_theme.dart';

/// The scan the terminal runs before it shows anything.
///
/// The signals are already on the server when this screen opens — nothing is
/// computed here. What the scan buys is a deliberate act: the player asks for
/// the read rather than walking into a screen of numbers, and the queue that
/// comes back is the one they asked for at that moment.
///
/// [onComplete] fires when the sweep finishes, and the terminal takes over.
class ScanGate extends StatefulWidget {
  const ScanGate({
    super.key,
    required this.gameLabel,
    required this.onScan,
    required this.onComplete,
    this.scale = 1,
  });

  final String gameLabel;

  /// Refreshes the queue. Awaited while the sweep runs, so the numbers on the
  /// other side are the ones fetched for this scan.
  final Future<void> Function() onScan;
  final VoidCallback onComplete;
  final double scale;

  @override
  State<ScanGate> createState() => _ScanGateState();
}

class _ScanGateState extends State<ScanGate> with TickerProviderStateMixin {
  static const _sweepDuration = Duration(milliseconds: 2600);

  late final AnimationController _sweep;
  late final AnimationController _idle;
  bool _scanning = false;
  int _stage = 0;
  Timer? _stageTimer;

  /// What the sweep says it is doing. The work is one fetch; the lines are
  /// there so a two-and-a-half second wait reads as progress.
  static const _stages = [
    'টার্মিনাল কানেক্ট হচ্ছে…',
    'রাউন্ড কিউ পড়া হচ্ছে…',
    'সিড হ্যাশ মেলানো হচ্ছে…',
    'সিগন্যাল রেডি',
  ];

  @override
  void initState() {
    super.initState();
    _sweep = AnimationController(vsync: this, duration: _sweepDuration);
    _idle = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _stageTimer?.cancel();
    _sweep.dispose();
    _idle.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    if (_scanning) return;
    setState(() {
      _scanning = true;
      _stage = 0;
    });

    final step = _sweepDuration.inMilliseconds ~/ _stages.length;
    _stageTimer = Timer.periodic(Duration(milliseconds: step), (timer) {
      if (!mounted) return timer.cancel();
      if (_stage >= _stages.length - 1) return timer.cancel();
      setState(() => _stage++);
    });

    // the fetch and the sweep run together; whichever is slower sets the pace
    await Future.wait([
      _sweep.forward(from: 0),
      widget.onScan().catchError((_) {}),
    ]);

    _stageTimer?.cancel();
    if (!mounted) return;
    widget.onComplete();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.scale;

    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 26 * s),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 216 * s,
              height: 216 * s,
              child: AnimatedBuilder(
                animation: Listenable.merge([_sweep, _idle]),
                builder: (context, _) {
                  return CustomPaint(
                    painter: _RadarPainter(
                      sweep: _scanning ? _sweep.value : null,
                      idle: _idle.value,
                    ),
                    child: Center(
                      child: Text(
                        _scanning
                            ? '${(_sweep.value * 100).round()}%'
                            : widget.gameLabel,
                        style: TextStyle(
                          color: NeonPalette.cyan,
                          fontSize: 22 * s,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 2,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            SizedBox(height: 26 * s),
            Text(
              _scanning ? _stages[_stage] : 'সিগন্যাল স্ক্যান করুন',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: NeonPalette.text,
                fontSize: 15 * s,
                fontWeight: FontWeight.w800,
              ),
            ),
            SizedBox(height: 8 * s),
            Text(
              _scanning
                  ? 'পরের রাউন্ডের সিগন্যাল আনা হচ্ছে'
                  : 'স্ক্যান করলে পরের রাউন্ডের সিগন্যাল দেখা যাবে',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: NeonPalette.muted,
                fontSize: 11.5 * s,
                height: 1.7,
              ),
            ),
            SizedBox(height: 26 * s),
            SizedBox(
              width: double.infinity,
              height: 52 * s,
              child: FilledButton(
                onPressed: _scanning ? null : _start,
                style: FilledButton.styleFrom(
                  backgroundColor: NeonPalette.cyan,
                  foregroundColor: NeonPalette.bgDeep,
                  disabledBackgroundColor:
                      NeonPalette.cyan.withOpacity(0.25),
                  disabledForegroundColor:
                      NeonPalette.bgDeep.withOpacity(0.5),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12 * s),
                  ),
                ),
                child: Text(
                  _scanning ? 'SCANNING…' : 'SCAN',
                  style: TextStyle(
                    fontSize: 15 * s,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 3,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The dial: static rings while it waits, a rotating wedge while it scans.
class _RadarPainter extends CustomPainter {
  const _RadarPainter({required this.sweep, required this.idle});

  /// 0..1 while scanning, null when idle.
  final double? sweep;
  final double idle;

  @override
  void paint(Canvas canvas, Size size) {
    final centre = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;

    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..color = NeonPalette.cyan.withOpacity(0.18);
    for (final f in [1.0, 0.74, 0.48, 0.22]) {
      canvas.drawCircle(centre, radius * f, ring);
    }

    final cross = Paint()
      ..strokeWidth = 1
      ..color = NeonPalette.cyan.withOpacity(0.12);
    canvas.drawLine(
      Offset(centre.dx - radius, centre.dy),
      Offset(centre.dx + radius, centre.dy),
      cross,
    );
    canvas.drawLine(
      Offset(centre.dx, centre.dy - radius),
      Offset(centre.dx, centre.dy + radius),
      cross,
    );

    if (sweep == null) {
      // idle: the outer ring breathes so the dial does not look dead
      canvas.drawCircle(
        centre,
        radius * (0.9 + idle * 0.08),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..color = NeonPalette.cyan.withOpacity(0.15 + idle * 0.25),
      );
      return;
    }

    final angle = sweep! * math.pi * 6; // three full turns over the sweep
    final wedge = Paint()
      ..shader = SweepGradient(
        startAngle: 0,
        endAngle: math.pi / 2,
        colors: [
          NeonPalette.cyan.withOpacity(0.45),
          NeonPalette.cyan.withOpacity(0),
        ],
        transform: GradientRotation(angle),
      ).createShader(Rect.fromCircle(center: centre, radius: radius));
    canvas.drawCircle(centre, radius, wedge);

    // the leading edge of the wedge
    canvas.drawLine(
      centre,
      centre + Offset(math.cos(angle), math.sin(angle)) * radius,
      Paint()
        ..strokeWidth = 2
        ..color = NeonPalette.mint.withOpacity(0.9),
    );

    // progress arc round the rim
    canvas.drawArc(
      Rect.fromCircle(center: centre, radius: radius - 1),
      -math.pi / 2,
      sweep! * math.pi * 2,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round
        ..color = NeonPalette.mint,
    );
  }

  @override
  bool shouldRepaint(_RadarPainter old) =>
      old.sweep != sweep || old.idle != idle;
}
