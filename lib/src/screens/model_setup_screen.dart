import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/model_manager_service.dart';
import '../state/app_state.dart';

/// オンデバイスAIモデルの導入（ダウンロード）と削除を行う画面。
class ModelSetupScreen extends StatefulWidget {
  const ModelSetupScreen({super.key});

  @override
  State<ModelSetupScreen> createState() => _ModelSetupScreenState();
}

class _ModelSetupScreenState extends State<ModelSetupScreen> {
  final _urlController = TextEditingController();
  final _tokenController = TextEditingController();

  bool _downloading = false;
  double _progress = 0;
  String? _error;

  @override
  void dispose() {
    _urlController.dispose();
    _tokenController.dispose();
    super.dispose();
  }

  Future<void> _startDownload() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) {
      setState(() => _error = 'モデルのダウンロードURLを入力してください。');
      return;
    }
    final appState = context.read<AppState>();
    final token = _tokenController.text.trim();

    setState(() {
      _downloading = true;
      _progress = 0;
      _error = null;
    });

    try {
      final stream = appState.modelManager.downloadFromNetwork(
        url,
        token: token.isEmpty ? null : token,
      );
      await for (final p in stream) {
        if (!mounted) return;
        setState(() => _progress = p);
      }
      await appState.refreshOnDeviceEngine();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('オンデバイスAIの準備が整いました。')),
      );
      Navigator.of(context).maybePop();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'ダウンロードに失敗しました: $e');
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  Future<void> _delete() async {
    final appState = context.read<AppState>();
    await appState.modelManager.delete();
    await appState.refreshOnDeviceEngine();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('モデルを削除しました。')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final appState = context.watch<AppState>();
    final info = ModelManagerService.recommendedModel;
    final ready = appState.isOnDeviceReady;

    return Scaffold(
      appBar: AppBar(title: const Text('オンデバイスAIの設定')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _StatusCard(ready: ready),
          const SizedBox(height: 20),
          Text('推奨モデル',
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(info.displayName,
                      style: theme.textTheme.titleSmall
                          ?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text('サイズの目安: ${info.sizeLabel}',
                      style: theme.textTheme.bodySmall),
                  const SizedBox(height: 8),
                  Text(info.note, style: theme.textTheme.bodyMedium),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text('モデルを導入する',
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(
            'MediaPipe LLM 形式（.task）の Gemma モデルのダウンロードURLを指定してください。'
            '配布元によってはアクセストークンが必要です。'
            'モデルはすべて端末内に保存され、会話の内容が外部へ送信されることはありません。',
            style: theme.textTheme.bodySmall
                ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _urlController,
            enabled: !_downloading,
            decoration: const InputDecoration(
              labelText: 'モデルのダウンロードURL',
              hintText: 'https://.../gemma-xxxx.task',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _tokenController,
            enabled: !_downloading,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'アクセストークン（任意）',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          if (_downloading) ...[
            LinearProgressIndicator(value: _progress == 0 ? null : _progress),
            const SizedBox(height: 8),
            Center(
              child: Text('ダウンロード中… ${(_progress * 100).toStringAsFixed(0)}%'),
            ),
          ] else
            FilledButton.icon(
              onPressed: _startDownload,
              icon: const Icon(Icons.download),
              label: const Text('ダウンロードして導入'),
            ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!,
                style: TextStyle(color: theme.colorScheme.error)),
          ],
          if (ready) ...[
            const SizedBox(height: 24),
            OutlinedButton.icon(
              onPressed: _downloading ? null : _delete,
              icon: const Icon(Icons.delete_outline),
              label: const Text('導入済みモデルを削除'),
              style: OutlinedButton.styleFrom(
                foregroundColor: theme.colorScheme.error,
              ),
            ),
          ],
          const SizedBox(height: 24),
          _PrivacyNote(),
        ],
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.ready});

  final bool ready;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      color: ready
          ? theme.colorScheme.primaryContainer
          : theme.colorScheme.surfaceContainerHighest,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(ready ? Icons.check_circle : Icons.info_outline,
                color: ready
                    ? theme.colorScheme.onPrimaryContainer
                    : theme.colorScheme.primary),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                ready
                    ? 'オンデバイスAIは導入済みです。通信なしで会話できます。'
                    : '現在はデモ応答モードです。モデルを導入すると本物のAI会話になります。',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: ready
                      ? theme.colorScheme.onPrimaryContainer
                      : theme.colorScheme.onSurface,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PrivacyNote extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.lock_outline,
              size: 18, color: theme.colorScheme.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'プライバシー: 推論はすべて端末内で実行されます。質問や会話の内容が'
              'サーバーへ送信されることはありません（モデルのダウンロード時のみ通信します）。',
              style: theme.textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}
