import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/model_info.dart';
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
  final _cloudKeyController = TextEditingController();

  bool _downloading = false;
  double _progress = 0;
  String? _error;

  @override
  void dispose() {
    _urlController.dispose();
    _tokenController.dispose();
    _cloudKeyController.dispose();
    super.dispose();
  }

  Future<void> _enableCloud() async {
    final key = _cloudKeyController.text.trim();
    if (key.isEmpty) {
      setState(() => _error = 'Gemini の API キーを入力してください。');
      return;
    }
    final appState = context.read<AppState>();
    await appState.enableCloud(apiKey: key);
    _cloudKeyController.clear();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('クラウドAI（Gemini）を有効にしました。')),
    );
    Navigator.of(context).maybePop();
  }

  Future<void> _disableCloud() async {
    await context.read<AppState>().disableCloud();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('クラウドAIを解除しました。')),
    );
  }

  /// 手入力URLからの導入。
  Future<void> _startManualDownload() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) {
      setState(() => _error = 'モデルのダウンロードURLを入力してください。');
      return;
    }
    final token = _tokenController.text.trim();
    await _download(
      url: url,
      token: token.isEmpty ? null : token,
      kind: ModelKind.gemma,
    );
  }

  /// プリセット／手入力 共通のダウンロード処理。
  Future<void> _download({
    required String url,
    String? token,
    required ModelKind kind,
  }) async {
    if (_downloading) return;
    final appState = context.read<AppState>();

    setState(() {
      _downloading = true;
      _progress = 0;
      _error = null;
    });

    try {
      final stream = appState.modelManager.downloadFromNetwork(
        url,
        token: token,
        kind: kind,
      );
      await for (final p in stream) {
        if (!mounted) return;
        setState(() => _progress = p);
      }
      await appState.refreshOnDeviceEngine();
      if (!mounted) return;
      if (appState.isOnDeviceReady) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('オンデバイスAIの準備が整いました。')),
        );
        Navigator.of(context).maybePop();
      } else {
        setState(() => _error =
            'ダウンロードは完了しましたが、モデルを起動できませんでした。'
            '（ブラウザの場合は WebGPU 対応をご確認ください）');
      }
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
    final ready = appState.isOnDeviceReady;

    return Scaffold(
      appBar: AppBar(title: const Text('オンデバイスAIの設定')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _StatusCard(ready: ready, cloudReady: appState.isCloudReady),
          const SizedBox(height: 20),
          _CloudSection(
            controller: _cloudKeyController,
            enabled: !_downloading,
            cloudReady: appState.isCloudReady,
            cloudModel: appState.cloudModel,
            onEnable: _enableCloud,
            onDisable: _disableCloud,
          ),
          const SizedBox(height: 24),
          const Divider(),
          const SizedBox(height: 8),
          Text('オンデバイスAI（端末内で完結）',
              style: theme.textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(
            '通信なしで動き、会話が外部に出ません。スマホアプリ版や、対応ブラウザ'
            '（Chrome/Edge + WebGPU）向けです。',
            style: theme.textTheme.bodySmall
                ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
          if (kIsWeb) ...[
            const SizedBox(height: 12),
            _WebNote(),
          ],
          const SizedBox(height: 16),
          Text('おすすめモデル（タップで導入）',
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(
            'いずれも無料・登録不要で、ブラウザ（Chrome/Edge + WebGPU）とAndroidの'
            '両方で動く軽量モデルです。初回のみダウンロードし、以降は端末内で完結します。',
            style: theme.textTheme.bodySmall
                ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 8),
          for (final preset in kModelPresets)
            _PresetCard(
              preset: preset,
              enabled: !_downloading,
              onTap: () => _download(url: preset.url, kind: preset.kind),
            ),
          const SizedBox(height: 20),
          Text('URLを指定して導入（上級者向け）',
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(
            'MediaPipe LLM 形式（.task）の Gemma モデルのダウンロードURLを指定できます。'
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
              onPressed: _startManualDownload,
              icon: const Icon(Icons.download),
              label: const Text('このURLから導入'),
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

class _PresetCard extends StatelessWidget {
  const _PresetCard({
    required this.preset,
    required this.enabled,
    required this.onTap,
  });

  final PresetModel preset;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 12, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(preset.name,
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text('サイズの目安: ${preset.sizeLabel}',
                style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant)),
            const SizedBox(height: 6),
            Text(preset.note, style: theme.textTheme.bodyMedium),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.tonalIcon(
                onPressed: enabled ? onTap : null,
                icon: const Icon(Icons.download, size: 18),
                label: const Text('導入'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.ready, required this.cloudReady});

  final bool ready;
  final bool cloudReady;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final active = ready || cloudReady;
    final String message;
    if (cloudReady) {
      message = 'クラウドAI（Gemini）が有効です。どの端末でも会話できます。';
    } else if (ready) {
      message = 'オンデバイスAIが導入済みです。通信なしで会話できます。';
    } else {
      message = '現在はデモ応答モードです。下のいずれかを設定すると本物のAI会話になります。';
    }
    return Card(
      color: active
          ? theme.colorScheme.primaryContainer
          : theme.colorScheme.surfaceContainerHighest,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(active ? Icons.check_circle : Icons.info_outline,
                color: active
                    ? theme.colorScheme.onPrimaryContainer
                    : theme.colorScheme.primary),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: active
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

/// クラウドAI（Gemini）の設定セクション。APIキーを入れて有効化する。
class _CloudSection extends StatelessWidget {
  const _CloudSection({
    required this.controller,
    required this.enabled,
    required this.cloudReady,
    required this.cloudModel,
    required this.onEnable,
    required this.onDisable,
  });

  final TextEditingController controller;
  final bool enabled;
  final bool cloudReady;
  final String? cloudModel;
  final VoidCallback onEnable;
  final VoidCallback onDisable;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.cloud_outlined, color: theme.colorScheme.primary),
            const SizedBox(width: 8),
            Text('クラウドAI（Gemini）',
                style: theme.textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          'iPhone・PC・Androidの全端末ですぐ動き、日本語も自然です。'
          '無料のAPIキーを Google AI Studio で取得して貼り付けてください。'
          '（会話内容は Google に送信されます。キーは端末内にのみ保存）',
          style: theme.textTheme.bodySmall
              ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
        ),
        const SizedBox(height: 4),
        SelectableText(
          'キー取得: https://aistudio.google.com/apikey',
          style: theme.textTheme.bodySmall
              ?.copyWith(color: theme.colorScheme.primary),
        ),
        const SizedBox(height: 12),
        if (cloudReady)
          Card(
            color: theme.colorScheme.primaryContainer,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('有効：${cloudModel ?? "gemini"}',
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.onPrimaryContainer,
                      )),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerRight,
                    child: OutlinedButton.icon(
                      onPressed: onDisable,
                      icon: const Icon(Icons.logout, size: 18),
                      label: const Text('解除'),
                    ),
                  ),
                ],
              ),
            ),
          )
        else ...[
          TextField(
            controller: controller,
            enabled: enabled,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'Gemini API キー',
              hintText: 'AIza...',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: enabled ? onEnable : null,
            icon: const Icon(Icons.cloud_done_outlined),
            label: const Text('クラウドAIを有効にする'),
          ),
        ],
      ],
    );
  }
}

class _WebNote extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.colorScheme.tertiaryContainer,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.science_outlined,
              size: 18, color: theme.colorScheme.onTertiaryContainer),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'ブラウザでのオンデバイスAIは実験的機能です。WebGPU 対応ブラウザ'
              '（Chrome / Edge の新しい版）が必要で、初回はモデルのダウンロードに'
              '時間がかかります。動かない場合は Android アプリ版をご利用ください。',
              style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onTertiaryContainer),
            ),
          ),
        ],
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
