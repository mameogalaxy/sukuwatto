import 'package:flutter/material.dart';

import '../models/historical_figure.dart';
import '../widgets/figure_portrait.dart';
import 'chat_screen.dart';

/// 人物のプロフィールを見せ、チャットへ誘導する画面。
class FigureDetailScreen extends StatelessWidget {
  const FigureDetailScreen({super.key, required this.figure});

  final HistoricalFigure figure;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final accent = figure.accentColor;

    return Scaffold(
      appBar: AppBar(title: Text(figure.name)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
        children: [
          Center(
            child: FigurePortrait(figure: figure, size: 120),
          ),
          const SizedBox(height: 16),
          Center(
            child: Text(figure.name,
                style: theme.textTheme.headlineSmall
                    ?.copyWith(fontWeight: FontWeight.bold)),
          ),
          Center(
            child: Text(figure.reading,
                style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant)),
          ),
          const SizedBox(height: 16),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 8,
            runSpacing: 8,
            children: [
              _InfoChip(icon: Icons.work_outline, label: figure.field),
              _InfoChip(icon: Icons.public, label: figure.region),
              _InfoChip(
                  icon: Icons.calendar_today, label: figure.lifespanLabel),
            ],
          ),
          const SizedBox(height: 24),
          _SectionTitle('どんな人？', accent: accent),
          const SizedBox(height: 8),
          Text(figure.bio,
              style: theme.textTheme.bodyMedium?.copyWith(height: 1.6)),
          const SizedBox(height: 24),
          _SectionTitle('こんな質問はいかが？', accent: accent),
          const SizedBox(height: 8),
          for (final q in figure.starterQuestions)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _StarterTile(
                question: q,
                onTap: () => _openChat(context, initialQuestion: q),
              ),
            ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openChat(context),
        icon: const Icon(Icons.chat_bubble_outline),
        label: Text('${figure.name}と話す'),
        backgroundColor: accent,
        foregroundColor: Colors.white,
      ),
    );
  }

  void _openChat(BuildContext context, {String? initialQuestion}) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ChatScreen(
          figure: figure,
          initialQuestion: initialQuestion,
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text, {required this.accent});

  final String text;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(width: 4, height: 18, color: accent),
        const SizedBox(width: 8),
        Text(text,
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.bold)),
      ],
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Chip(
      avatar: Icon(icon, size: 16, color: theme.colorScheme.primary),
      label: Text(label),
      visualDensity: VisualDensity.compact,
    );
  }
}

class _StarterTile extends StatelessWidget {
  const _StarterTile({required this.question, required this.onTap});

  final String question;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: theme.colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Icon(Icons.help_outline,
                  size: 18, color: theme.colorScheme.primary),
              const SizedBox(width: 10),
              Expanded(child: Text(question)),
              Icon(Icons.arrow_forward,
                  size: 16, color: theme.colorScheme.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}
