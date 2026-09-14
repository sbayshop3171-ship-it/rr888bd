import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:prime_signal_app/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const storageChannel =
      MethodChannel('plugins.it_nomads.com/flutter_secure_storage');

  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      storageChannel,
      (call) async {
        if (call.method == 'read') return null;
        return null;
      },
    );
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(storageChannel, null);
  });

  testWidgets('app starts locked until an access key unlocks it',
      (tester) async {
    await tester.pumpWidget(const PrimeSignalApp());
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('RR888BD'), findsOneWidget);
    expect(find.text('UNLOCK'), findsOneWidget);
    expect(find.textContaining('awaiting access key'), findsOneWidget);
  });
}
