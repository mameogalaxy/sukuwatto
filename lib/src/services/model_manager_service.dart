import 'package:flutter/foundation.dart';
import 'package:flutter_gemma/flutter_gemma.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// オンデバイス用 Gemma モデルのダウンロード・導入・削除を担当する。
///
/// flutter_gemma の modelManager をラップし、画面側に進捗ストリームと
/// 単純な API を提供する。
class ModelManagerService {
  static const _installedKey = 'gemma_model_installed';

  /// 既定で案内するモデル。
  ///
  /// MediaPipe LLM Inference 形式（.task）の量子化 Gemma を想定。
  /// 実際の配布 URL とライセンス同意は利用者側で用意する必要があるため、
  /// URL は設定画面から差し替えられるようにしている（ここは案内用の既定値）。
  static const recommendedModel = GemmaModelInfo(
    displayName: 'Gemma 3 1B (Instruction Tuned, INT4)',
    sizeLabel: '約 0.5 GB',
    note: 'スマートフォン向けに最適化された軽量モデル。日本語にも対応。',
  );

  final _modelManager = FlutterGemmaPlugin.instance.modelManager;

  /// モデルが導入済みか。
  Future<bool> isInstalled() async {
    try {
      return await _modelManager.isModelInstalled;
    } catch (e) {
      debugPrint('isInstalled エラー: $e');
      final prefs = await SharedPreferences.getInstance();
      return prefs.getBool(_installedKey) ?? false;
    }
  }

  /// ネットワークからモデルをダウンロードし、進捗(0.0〜1.0)を流す。
  ///
  /// [token] は配布元が認証を要求する場合のアクセストークン。
  Stream<double> downloadFromNetwork(String url, {String? token}) async* {
    try {
      final stream = token == null
          ? _modelManager.downloadModelFromNetworkWithProgress(url)
          : _modelManager.downloadModelFromNetworkWithProgress(url,
              token: token);
      await for (final progress in stream) {
        // プラグインは 0〜100(int) を流すため 0.0〜1.0 に正規化。
        yield (progress.clamp(0, 100)) / 100.0;
      }
      await _markInstalled(true);
    } catch (e) {
      debugPrint('ダウンロードエラー: $e');
      rethrow;
    }
  }

  /// 端末内のローカルファイルパスからモデルを設定する。
  Future<void> setFromLocalPath(String path) async {
    await _modelManager.setModelPath(path);
    await _markInstalled(true);
  }

  /// 導入済みモデルを削除する。
  Future<void> delete() async {
    try {
      await _modelManager.deleteModel();
    } catch (e) {
      debugPrint('削除エラー: $e');
    }
    await _markInstalled(false);
  }

  Future<void> _markInstalled(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_installedKey, value);
  }
}

/// モデルのメタ情報（案内表示用）。
@immutable
class GemmaModelInfo {
  const GemmaModelInfo({
    required this.displayName,
    required this.sizeLabel,
    required this.note,
  });

  final String displayName;
  final String sizeLabel;
  final String note;
}
