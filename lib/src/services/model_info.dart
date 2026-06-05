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

/// モデルの系統。flutter_gemma の ModelType へマッピングするための、UI 層から
/// flutter_gemma 依存を切り離した列挙。
enum ModelKind { gemma, qwen, qwen3, deepSeek, general }

/// ワンタップで導入できる推奨モデル。
///
/// すべて「ライセンス同意・トークン不要（非ゲート）」かつ Web/Android 両対応の
/// `.task` 形式（litert-community 公開、flutter_gemma 公式サンプルでも採用）。
/// URL は配布元の都合で変わる可能性があるため、設定画面から手入力でも導入できる。
class PresetModel {
  const PresetModel({
    required this.name,
    required this.url,
    required this.kind,
    required this.sizeLabel,
    required this.note,
  });

  final String name;
  final String url;
  final ModelKind kind;
  final String sizeLabel;
  final String note;
}

/// 推奨プリセット一覧（軽量順ではなく、おすすめ順）。
const List<PresetModel> kModelPresets = [
  PresetModel(
    name: 'Qwen2.5 1.5B Instruct（おすすめ・バランス）',
    url:
        'https://huggingface.co/litert-community/Qwen2.5-1.5B-Instruct/resolve/main/Qwen2.5-1.5B-Instruct_multi-prefill-seq_q8_ekv1280.task',
    kind: ModelKind.qwen,
    sizeLabel: '約 1.6 GB',
    note: '日本語もそこそこ話せて、品質と容量のバランスが良い。',
  ),
  PresetModel(
    name: 'Qwen2.5 0.5B Instruct（軽量・最速）',
    url:
        'https://huggingface.co/litert-community/Qwen2.5-0.5B-Instruct/resolve/main/Qwen2.5-0.5B-Instruct_multi-prefill-seq_q8_ekv1280.task',
    kind: ModelKind.qwen,
    sizeLabel: '約 0.5 GB',
    note: 'ダウンロードが速く、まず試すのに最適。簡単な会話向け。',
  ),
  PresetModel(
    name: 'SmolLM 135M（超軽量・動作確認用）',
    url:
        'https://huggingface.co/litert-community/SmolLM-135M-Instruct/resolve/main/SmolLM-135M-Instruct_multi-prefill-seq_q8_ekv1280.task',
    kind: ModelKind.general,
    sizeLabel: '約 135 MB',
    note: '最小サイズ。まず仕組みを動かしたいとき用。日本語は苦手。',
  ),
];
