import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../data/figures_repository.dart';
import '../models/historical_figure.dart';
import '../state/app_state.dart';
import '../widgets/figure_card.dart';
import 'about_screen.dart';
import 'figure_detail_screen.dart';
import 'model_setup_screen.dart';

/// 人物を選ぶホーム画面。
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String _query = '';
  String? _fieldFilter;

  @override
  Widget build(BuildContext context) {
    final repo = context.read<FiguresRepository>();
    final figures = _filtered(repo.all());

    return Scaffold(
      appBar: AppBar(
        title: const Text('いざない'),
        actions: [
          IconButton(
            icon: const Icon(Icons.info_outline),
            tooltip: 'このアプリについて',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const AboutScreen()),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          const _EngineStatusBanner(),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: Text(
              '歴史の人物に、直接きいてみよう。',
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          _SearchBar(
            onChanged: (v) => setState(() => _query = v),
          ),
          _FieldFilter(
            fields: repo.fields,
            selected: _fieldFilter,
            onSelected: (f) => setState(() => _fieldFilter = f),
          ),
          Expanded(
            child: figures.isEmpty
                ? const _EmptyState()
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
                    itemCount: figures.length,
                    itemBuilder: (context, i) {
                      final figure = figures[i];
                      return FigureCard(
                        figure: figure,
                        onTap: () => _openFigure(context, figure),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  List<HistoricalFigure> _filtered(List<HistoricalFigure> all) {
    final q = _query.trim();
    return all.where((f) {
      final matchesField = _fieldFilter == null || f.field == _fieldFilter;
      final matchesQuery = q.isEmpty ||
          f.name.contains(q) ||
          f.reading.contains(q) ||
          f.tagline.contains(q) ||
          f.region.contains(q);
      return matchesField && matchesQuery;
    }).toList();
  }

  void _openFigure(BuildContext context, HistoricalFigure figure) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => FigureDetailScreen(figure: figure)),
    );
  }
}

/// 現在の会話エンジンの状態を示す帯。デモ応答中なら設定への導線を出す。
class _EngineStatusBanner extends StatelessWidget {
  const _EngineStatusBanner();

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final theme = Theme.of(context);
    final cloud = appState.isCloudReady;
    final ready = cloud || appState.isOnDeviceReady;

    final color = ready
        ? theme.colorScheme.primaryContainer
        : theme.colorScheme.tertiaryContainer;
    final onColor = ready
        ? theme.colorScheme.onPrimaryContainer
        : theme.colorScheme.onTertiaryContainer;

    final readyLabel = cloud
        ? 'クラウドAI（Gemini）で会話中'
        : 'オンデバイスAI 稼働中（通信なしで会話できます）';

    return Material(
      color: color,
      child: InkWell(
        onTap: ready
            ? null
            : () => Navigator.of(context).push(
                  MaterialPageRoute(
                      builder: (_) => const ModelSetupScreen()),
                ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              Icon(ready ? Icons.verified_user : Icons.download_for_offline,
                  size: 20, color: onColor),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  ready
                      ? readyLabel
                      : 'デモ応答モードです。タップして本物のAI（クラウド/オンデバイス）を設定できます。',
                  style: theme.textTheme.bodySmall?.copyWith(color: onColor),
                ),
              ),
              if (!ready)
                Icon(Icons.chevron_right, size: 20, color: onColor),
            ],
          ),
        ),
      ),
    );
  }
}

class _SearchBar extends StatelessWidget {
  const _SearchBar({required this.onChanged});

  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: TextField(
        onChanged: onChanged,
        decoration: InputDecoration(
          hintText: '名前・分野・地域で探す',
          prefixIcon: const Icon(Icons.search),
          filled: true,
          fillColor: Theme.of(context).colorScheme.surfaceContainerHighest,
          contentPadding: const EdgeInsets.symmetric(vertical: 0),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    );
  }
}

class _FieldFilter extends StatelessWidget {
  const _FieldFilter({
    required this.fields,
    required this.selected,
    required this.onSelected,
  });

  final List<String> fields;
  final String? selected;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: ChoiceChip(
              label: const Text('すべて'),
              selected: selected == null,
              onSelected: (_) => onSelected(null),
            ),
          ),
          for (final field in fields)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: ChoiceChip(
                label: Text(field),
                selected: selected == field,
                onSelected: (_) => onSelected(field),
              ),
            ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('🔍', style: TextStyle(fontSize: 40)),
          const SizedBox(height: 12),
          Text('該当する人物が見つかりません',
              style: Theme.of(context).textTheme.bodyLarge),
        ],
      ),
    );
  }
}
