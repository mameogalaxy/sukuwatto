import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'data/figures_repository.dart';
import 'screens/home_screen.dart';
import 'state/app_state.dart';
import 'theme/app_theme.dart';

/// アプリのルート。依存（AppState・人物リポジトリ）を提供し、テーマと最初の画面を設定する。
class IzanaiApp extends StatelessWidget {
  const IzanaiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<FiguresRepository>(
          create: (_) => const FiguresRepository(),
        ),
        ChangeNotifierProvider<AppState>(
          create: (_) => AppState()..init(),
        ),
      ],
      child: MaterialApp(
        title: 'いざない',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: ThemeMode.system,
        home: const HomeScreen(),
      ),
    );
  }
}
