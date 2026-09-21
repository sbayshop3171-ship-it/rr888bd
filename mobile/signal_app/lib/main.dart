import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'config/api_config.dart';
import 'screens/signal_access_gate.dart';
import 'theme/neon_theme.dart';
import 'widgets/update_check.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      systemNavigationBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  runApp(const PrimeSignalApp());
}

class PrimeSignalApp extends StatelessWidget {
  const PrimeSignalApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'AVIATOR SIGNAL V9',
      theme: buildNeonTheme(),
      home: const UpdateCheck(
        apiBaseUrl: signalApiBaseUrl,
        child: SignalAccessGate(apiBaseUrl: signalApiBaseUrl),
      ),
    );
  }
}
