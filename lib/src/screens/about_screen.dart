import 'package:flutter/material.dart';

import 'model_setup_screen.dart';

/// アプリの説明・注意書きを表示する画面。
class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('このアプリについて')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('いざない',
              style: theme.textTheme.headlineSmall
                  ?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text('歴史の人物と話して学ぶ', style: theme.textTheme.titleMedium),
          const SizedBox(height: 20),
          _Para(
            '歴史上の人物に直接質問することで、その人が何をして、どの時代に'
            'どんなことを考えていたのかを、会話を通して学べるアプリです。'
            '相手の応答はオンデバイスAIが自動で生成します。',
          ),
          const SizedBox(height: 20),
          _Feature(
            icon: Icons.smartphone,
            title: 'オンデバイスAI',
            body: '会話はすべて端末内のAIで生成されます。電波の届かない場所でも動き、'
                '会話内容は外部に送信されません。',
          ),
          _Feature(
            icon: Icons.school_outlined,
            title: '学びのために',
            body: '人物は史実・通説に基づいて答えます。授業の予習復習や、'
                '歴史への興味のきっかけづくりに。',
          ),
          _Feature(
            icon: Icons.info_outline,
            title: 'ご注意',
            body: 'AIの応答には誤りが含まれることがあります。'
                '大切な情報は教科書や信頼できる資料でも確認してください。',
          ),
          const SizedBox(height: 16),
          FilledButton.tonalIcon(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ModelSetupScreen()),
            ),
            icon: const Icon(Icons.tune),
            label: const Text('オンデバイスAIの設定'),
          ),
          const SizedBox(height: 24),
          Text('バージョン 0.1.0',
              style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant)),
        ],
      ),
    );
  }
}

class _Para extends StatelessWidget {
  const _Para(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text,
        style: Theme.of(context)
            .textTheme
            .bodyMedium
            ?.copyWith(height: 1.6));
  }
}

class _Feature extends StatelessWidget {
  const _Feature({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: theme.colorScheme.primaryContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: theme.colorScheme.onPrimaryContainer),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: theme.textTheme.titleSmall
                        ?.copyWith(fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text(body,
                    style: theme.textTheme.bodyMedium?.copyWith(height: 1.5)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
