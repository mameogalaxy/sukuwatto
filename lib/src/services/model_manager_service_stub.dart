import 'dart:async';

import 'model_info.dart';

/// Web 等、オンデバイスモデルを扱えないプラットフォーム向けのダミー実装。
///
/// flutter_gemma を import せず、ダウンロード系は未対応として振る舞う。
class ModelManagerService {
  /// 画面表示用の推奨モデル情報（案内のためだけに保持）。
  static const GemmaModelInfo recommendedModel = recommendedGemmaModel;

  Future<void> initialize() async {}

  Future<bool> isInstalled() async => false;

  Stream<double> downloadFromNetwork(String url, {String? token}) {
    return Stream<double>.error(
      UnsupportedError('このプラットフォームではモデルのダウンロードに対応していません。'),
    );
  }

  Future<void> delete() async {}
}
