import 'package:flutter/material.dart';

import '../models/signal_snapshot.dart';
import '../theme/neon_theme.dart';

class BrandTerminal extends StatelessWidget {
  const BrandTerminal({
    super.key,
    required this.snapshot,
    this.scale = 1,
  });

  final SignalSnapshot snapshot;
  final double scale;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(
        18 * scale,
        16 * scale,
        18 * scale,
        13 * scale,
      ),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.58),
        borderRadius: BorderRadius.circular(8 * scale),
        border: Border.all(color: NeonPalette.cyan.withOpacity(0.42)),
        boxShadow: [
          BoxShadow(
            color: NeonPalette.cyan.withOpacity(0.2),
            blurRadius: 24 * scale,
            spreadRadius: 1,
          ),
          BoxShadow(
            color: NeonPalette.green.withOpacity(0.1),
            blurRadius: 40 * scale,
            offset: Offset(0, 12 * scale),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8 * scale),
                child: Image.asset(
                  'assets/aviator_signal_v9.png',
                  width: 34 * scale,
                  height: 34 * scale,
                  fit: BoxFit.cover,
                ),
              ),
              SizedBox(width: 10 * scale),
              Flexible(
                child: Text(
                  snapshot.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: NeonPalette.text,
                    fontSize: 18 * scale,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: 7 * scale),
          Text(
            snapshot.subtitle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: NeonPalette.muted,
              fontSize: 10 * scale,
              fontWeight: FontWeight.w800,
            ),
          ),
          SizedBox(height: 10 * scale),
          Container(
            padding: EdgeInsets.symmetric(
              horizontal: 12 * scale,
              vertical: 5 * scale,
            ),
            decoration: BoxDecoration(
              color: NeonPalette.green.withOpacity(0.13),
              borderRadius: BorderRadius.circular(4 * scale),
              border: Border.all(color: NeonPalette.green.withOpacity(0.35)),
            ),
            child: Text(
              snapshot.modeBadge,
              style: TextStyle(
                color: NeonPalette.green,
                fontSize: 9 * scale,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
