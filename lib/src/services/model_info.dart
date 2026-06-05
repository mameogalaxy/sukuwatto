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

/// 既定で案内するオンデバイスモデル。
const GemmaModelInfo recommendedGemmaModel = GemmaModelInfo(
  displayName: 'Gemma 3 1B (Instruction Tuned, INT4)',
  sizeLabel: '約 0.5 GB',
  note: 'スマートフォン向けに最適化された軽量モデル。日本語にも対応。',
);
