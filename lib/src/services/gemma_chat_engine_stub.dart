import 'dart:async';

import '../models/chat_message.dart';
import '../models/historical_figure.dart';
import 'chat_engine.dart';

/// Web 等、オンデバイス推論が使えないプラットフォーム向けのダミー実装。
///
/// flutter_gemma（ネイティブ専用）を一切 import せず、常に「未対応」として振る舞う。
/// これにより Web ビルドが通り、実際の会話は [MockChatEngine]（デモ応答）が担う。
class GemmaChatEngine implements ChatEngine {
  GemmaChatEngine({
    this.maxTokens = 1024,
    this.temperature = 0.8,
    this.topK = 40,
  });

  final int maxTokens;
  final double temperature;
  final int topK;

  @override
  bool get isReady => false;

  @override
  String get statusLabel => 'このプラットフォームではオンデバイスAIは利用できません';

  /// Web では端末内モデルを扱えないため常に false。
  Future<bool> isModelInstalled() async => false;

  @override
  Future<void> initialize() async {}

  @override
  Stream<String> generate({
    required HistoricalFigure figure,
    required List<ChatMessage> history,
    required String userMessage,
  }) {
    throw StateError('このプラットフォームではオンデバイスAIは利用できません。');
  }

  @override
  Future<void> dispose() async {}
}
