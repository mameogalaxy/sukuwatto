import '../models/chat_message.dart';
import '../models/historical_figure.dart';

/// 会話AIエンジンの抽象インターフェース。
///
/// 実装は2つ:
/// - [MockChatEngine]   : モデル不要。すぐ動かして UI を確認するための簡易応答。
/// - [GemmaChatEngine]  : flutter_gemma によるオンデバイス LLM 推論。
///
/// 画面・状態管理層はこのインターフェースだけに依存し、実体の差し替えを容易にする。
abstract class ChatEngine {
  /// エンジンが応答可能かどうか。
  bool get isReady;

  /// 人間に見せる現在の状態説明（未準備の理由など）。
  String get statusLabel;

  /// 必要な初期化（モデル読み込み等）を行う。
  Future<void> initialize();

  /// ユーザー発言に対する人物の応答を、トークン断片のストリームとして返す。
  ///
  /// [history] は今回の [userMessage] を含まない過去のやり取り。
  Stream<String> generate({
    required HistoricalFigure figure,
    required List<ChatMessage> history,
    required String userMessage,
  });

  /// リソース解放。
  Future<void> dispose();
}

/// 人物プロンプト＋会話履歴から、命令調モデル向けの1本のプロンプト文字列を組み立てる。
///
/// Gemma などの instruction-tuned モデルでも、Mock エンジンでも共通で使えるよう
/// プレーンテキストとして表現する。GemmaChatEngine 側でモデル固有のテンプレートに包む。
String buildConversationPrompt({
  required HistoricalFigure figure,
  required List<ChatMessage> history,
  required String userMessage,
}) {
  final buffer = StringBuffer()
    ..writeln(figure.systemPrompt.trim())
    ..writeln()
    ..writeln('--- これまでの会話 ---');

  if (history.isEmpty) {
    buffer.writeln('(まだ会話はありません)');
  } else {
    for (final m in history) {
      if (m.isError) continue;
      final speaker = m.isUser ? '質問者' : figure.name;
      buffer.writeln('$speaker: ${m.text.trim()}');
    }
  }

  buffer
    ..writeln()
    ..writeln('質問者: ${userMessage.trim()}')
    ..writeln('${figure.name}: ');

  return buffer.toString();
}
