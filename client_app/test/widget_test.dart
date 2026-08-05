import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:client_app/main.dart';

void main() {
  testWidgets('renders PulseFit member entry screen', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const ProviderScope(child: ClientApp()));
    await tester.pumpAndSettle();

    expect(find.text('Get started'), findsOneWidget);
    expect(find.text('Email Address / Phone'), findsNothing);

    await tester.tap(find.text('Get started'));
    await tester.pumpAndSettle();

    expect(find.text('Email Address / Phone'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
  });
}
