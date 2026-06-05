import 'dart:async';
import 'dart:math';

import '../models/chat_message.dart';
import '../models/historical_figure.dart';
import 'chat_engine.dart';

/// モデルを導入しなくても UI を一通り体験できるようにする簡易エンジン。
///
/// 実際の LLM ではなく、人物プロフィールを使ったテンプレート応答を、
/// 本物らしく1文字ずつストリーミングして返す。開発・デモ・モデル未導入時の
/// フォールバックとして使う。
class MockChatEngine implements ChatEngine {
  final Random _random = Random();

  @override
  bool get isReady => true;

  @override
  String get statusLabel => 'デモ応答モード（オンデバイスAI未導入）';

  @override
  Future<void> initialize() async {}

  @override
  Future<void> dispose() async {}

  @override
  Stream<String> generate({
    required HistoricalFigure figure,
    required List<ChatMessage> history,
    required String userMessage,
  }) async* {
    // それらしい考え中の間を演出。
    await Future<void>.delayed(const Duration(milliseconds: 350));

    final reply = _composeReply(figure, userMessage);

    // 1〜2文字ずつ、わずかな間を空けて流し込みストリーミングを再現する。
    final buffer = StringBuffer();
    for (var i = 0; i < reply.length; i++) {
      buffer.write(reply[i]);
      if (i % 2 == 1) {
        yield buffer.toString();
        buffer.clear();
        await Future<void>.delayed(
            Duration(milliseconds: 18 + _random.nextInt(22)));
      }
    }
    if (buffer.isNotEmpty) yield buffer.toString();
  }

  String _composeReply(HistoricalFigure figure, String userMessage) {
    final lifespan = figure.lifespanLabel;
    return 'これはデモ用の応答です。実際の会話には、設定画面からオンデバイスAIモデルを'
        '導入してください。\n\n'
        '私は${figure.name}（${figure.reading}）、${lifespan}を生きた'
        '${figure.region}の${figure.field}です。'
        '「$userMessage」という問いですね。'
        'モデルを導入すれば、私になりきってこの問いにお答えします。';
  }
}
