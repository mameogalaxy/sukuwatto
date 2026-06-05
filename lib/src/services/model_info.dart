import 'package:flutter/foundation.dart';

/// モデルのメタ情報（案内表示用）。プラットフォーム非依存。
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

/// 既定で案内するオンデバイスモデル（軽量・1B〜4B級）。
///
/// スマホ／ブラウザ（WebGPU）でも動かせる現実的なサイズを想定。
const GemmaModelInfo recommendedGemmaModel = GemmaModelInfo(
  displayName: '軽量モデル（Gemma 1B〜4B 級, INT4/INT8）',
  sizeLabel: '約 0.5〜3 GB',
  note: 'スマホ・対応ブラウザ（Chrome/Edge + WebGPU）で動かせる軽量クラス。'
      '初回のみモデルをダウンロードし、以降は端末内で完結します。',
);
