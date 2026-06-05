import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_gemma/flutter_gemma.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'model_info.dart';

/// オンデバイス用 Gemma モデルのダウンロード・導入・削除を担当する（ネイティブ実装）。
///
/// flutter_gemma 0.13 系の Modern API（FlutterGemma.installModel など）を利用する。
class ModelManagerService {
  static const _urlKey = 'gemma_model_url';
  static const _idKey = 'gemma_model_id';
  static const _kindKey = 'gemma_model_kind';

  /// 画面表示用の推奨モデル情報。
  static const GemmaModelInfo recommendedModel = recommendedGemmaModel;

  static bool _frameworkInitialized = false;

  /// ModelKind を flutter_gemma の ModelType へ対応づける。
  static ModelType _modelTypeFor(ModelKind kind) {
    switch (kind) {
      case ModelKind.gemma:
        return ModelType.gemmaIt;
      case ModelKind.qwen:
        return ModelType.qwen;
      case ModelKind.qwen3:
        return ModelType.qwen3;
      case ModelKind.deepSeek:
        return ModelType.deepSeek;
      case ModelKind.general:
        return ModelType.general;
    }
  }

  /// flutter_gemma を初期化し、前回導入済みのモデルがあれば再度アクティブにする。
  /// アプリ起動時に一度だけ呼ぶ。
  Future<void> initialize() async {
    if (!_frameworkInitialized) {
      await FlutterGemma.initialize();
      _frameworkInitialized = true;
    }
    await _restoreActiveModel();
  }

  /// 端末にモデルが導入され、利用可能（アクティブ）かどうか。
  Future<bool> isInstalled() async {
    try {
      return FlutterGemma.hasActiveModel();
    } catch (e) {
      debugPrint('isInstalled エラー: $e');
      return false;
    }
  }

  /// ネットワークからモデルをダウンロード＆導入し、進捗(0.0〜1.0)を流す。
  ///
  /// 完了するとそのモデルが自動的にアクティブになる（Modern API の仕様）。
  /// [kind] はモデルの系統（Gemma / Qwen など）。チャットテンプレートの選択に使う。
  Stream<double> downloadFromNetwork(
    String url, {
    String? token,
    ModelKind kind = ModelKind.gemma,
  }) {
    final controller = StreamController<double>();
    () async {
      try {
        final installation = await FlutterGemma.installModel(
          modelType: _modelTypeFor(kind),
        )
            .fromNetwork(url, token: token)
            .withProgress((p) => controller.add((p.clamp(0, 100)) / 100.0))
            .install();
        await _saveModel(url: url, id: installation.modelId, kind: kind);
        controller.add(1.0);
      } catch (e) {
        debugPrint('ダウンロードエラー: $e');
        controller.addError(e);
      } finally {
        await controller.close();
      }
    }();
    return controller.stream;
  }

  /// 導入済みモデルを削除する。
  Future<void> delete() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final id = prefs.getString(_idKey);
      if (id != null) {
        await FlutterGemma.uninstallModel(id);
      } else {
        // 念のため、残っている全モデルを削除する。
        for (final m in await FlutterGemma.listInstalledModels()) {
          await FlutterGemma.uninstallModel(m);
        }
      }
    } catch (e) {
      debugPrint('削除エラー: $e');
    }
    await _clearSaved();
  }

  /// 前回導入したモデルを再アクティブ化する（ダウンロードは行わない）。
  Future<void> _restoreActiveModel() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final url = prefs.getString(_urlKey);
      if (url == null) return;
      final installed = await FlutterGemma.listInstalledModels();
      if (installed.isEmpty) return;
      final kindIndex = prefs.getInt(_kindKey) ?? ModelKind.gemma.index;
      final kind = ModelKind.values[kindIndex.clamp(0, ModelKind.values.length - 1)];
      // install() は導入済みならダウンロードをスキップし、アクティブ化のみ行う。
      await FlutterGemma.installModel(modelType: _modelTypeFor(kind))
          .fromNetwork(url)
          .install();
    } catch (e) {
      debugPrint('モデル復元エラー: $e');
    }
  }

  Future<void> _saveModel({
    required String url,
    required String id,
    required ModelKind kind,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_urlKey, url);
    await prefs.setString(_idKey, id);
    await prefs.setInt(_kindKey, kind.index);
  }

  Future<void> _clearSaved() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_urlKey);
    await prefs.remove(_idKey);
    await prefs.remove(_kindKey);
  }
}
