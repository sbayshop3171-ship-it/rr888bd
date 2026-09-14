import 'package:flutter/material.dart';

import '../services/app_updater.dart';
import '../theme/neon_theme.dart';

/// Wraps the app and offers a newer build when the server has one: on launch,
/// and again whenever the app comes back to the front (at most every ten
/// minutes), so a phone left open all day still hears about it.
class UpdateCheck extends StatefulWidget {
  const UpdateCheck({super.key, required this.apiBaseUrl, required this.child});

  final String apiBaseUrl;
  final Widget child;

  @override
  State<UpdateCheck> createState() => _UpdateCheckState();
}

class _UpdateCheckState extends State<UpdateCheck> with WidgetsBindingObserver {
  late final AppUpdater _updater = AppUpdater(widget.apiBaseUrl);
  DateTime? _lastCheck;
  bool _showing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _check());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _check();
  }

  Future<void> _check() async {
    if (widget.apiBaseUrl.isEmpty || _showing) return;
    final now = DateTime.now();
    if (_lastCheck != null && now.difference(_lastCheck!) < const Duration(minutes: 10)) return;
    _lastCheck = now;

    final update = await _updater.check();
    if (update == null || !mounted || _showing) return;
    _showing = true;
    await showDialog<void>(
      context: context,
      barrierDismissible: !update.force,
      builder: (_) => _UpdateDialog(update: update, updater: _updater),
    );
    _showing = false;
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

enum _Stage { offer, downloading, failed }

class _UpdateDialog extends StatefulWidget {
  const _UpdateDialog({required this.update, required this.updater});

  final AppUpdate update;
  final AppUpdater updater;

  @override
  State<_UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<_UpdateDialog> {
  _Stage _stage = _Stage.offer;
  double _progress = 0;
  String? _path;
  bool _needsPermission = false;

  Future<void> _go() async {
    // Android's "install unknown apps" switch, once per phone: without it the
    // installer refuses, so send the player there first and let them come back
    if (!await widget.updater.canInstall()) {
      setState(() => _needsPermission = true);
      await widget.updater.openInstallSettings();
      return;
    }
    setState(() => _needsPermission = false);

    if (_path == null) {
      setState(() { _stage = _Stage.downloading; _progress = 0; });
      try {
        _path = await widget.updater.download(widget.update, (p) {
          if (mounted) setState(() => _progress = p);
        });
      } catch (_) {
        if (mounted) setState(() => _stage = _Stage.failed);
        return;
      }
    }
    await widget.updater.install(_path!);
    if (mounted) setState(() => _stage = _Stage.offer);
  }

  @override
  Widget build(BuildContext context) {
    final u = widget.update;
    final downloading = _stage == _Stage.downloading;

    return PopScope(
      canPop: !u.force && !downloading,
      child: Dialog(
        backgroundColor: NeonPalette.panel,
        insetPadding: const EdgeInsets.symmetric(horizontal: 26),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: NeonPalette.cyan.withOpacity(0.45)),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.system_update_rounded, color: NeonPalette.cyan, size: 44),
              const SizedBox(height: 10),
              const Text(
                'নতুন আপডেট এসেছে',
                textAlign: TextAlign.center,
                style: TextStyle(color: NeonPalette.text, fontSize: 19, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 4),
              Text(
                'ভার্সন ${u.versionName}',
                textAlign: TextAlign.center,
                style: const TextStyle(color: NeonPalette.cyan, fontSize: 13, fontWeight: FontWeight.w800),
              ),
              if (u.notes.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  u.notes,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: NeonPalette.text.withOpacity(0.8), fontSize: 13, height: 1.45),
                ),
              ],
              const SizedBox(height: 16),
              if (downloading) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: LinearProgressIndicator(
                    value: _progress > 0 ? _progress : null,
                    minHeight: 8,
                    backgroundColor: NeonPalette.cyan.withOpacity(0.12),
                    color: NeonPalette.mint,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'ডাউনলোড হচ্ছে… ${(_progress * 100).round()}%',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: NeonPalette.muted, fontSize: 12, fontWeight: FontWeight.w700),
                ),
              ] else ...[
                if (_needsPermission)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 10),
                    child: Text(
                      'সেটিংস থেকে "Allow from this source" চালু করে ফিরে এসে আবার "আপডেট করুন" চাপুন।',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: NeonPalette.gold, fontSize: 12.5, height: 1.4, fontWeight: FontWeight.w700),
                    ),
                  ),
                if (_stage == _Stage.failed)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 10),
                    child: Text(
                      'ডাউনলোড হয়নি — ইন্টারনেট দেখে আবার চেষ্টা করুন।',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: NeonPalette.red, fontSize: 12.5, fontWeight: FontWeight.w700),
                    ),
                  ),
                FilledButton(
                  onPressed: _go,
                  style: FilledButton.styleFrom(
                    backgroundColor: NeonPalette.cyan,
                    foregroundColor: NeonPalette.bgDeep,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: Text(
                    _path == null ? 'আপডেট করুন' : 'ইনস্টল করুন',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                  ),
                ),
                if (!u.force)
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('পরে', style: TextStyle(color: NeonPalette.muted, fontWeight: FontWeight.w700)),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
