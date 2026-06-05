import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/chat_message.dart';
import '../models/historical_figure.dart';
import '../services/chat_engine.dart';

/// 1人の人物との会話セッションを管理するコントローラ。
class ChatController extends ChangeNotifier {
  ChatController({
    required this.figure,
    required ChatEngine engine,
  }) : _engine = engine;

  final HistoricalFigure figure;
  ChatEngine _engine;

  final List<ChatMessage> _messages = [];
  List<ChatMessage> get messages => List.unmodifiable(_messages);

  bool _isGenerating = false;
  bool get isGenerating => _isGenerating;

  StreamSubscription<String>? _subscription;
  int _idCounter = 0;

  String _nextId() => 'm${_idCounter++}';

  /// 会話中にエンジンが差し替わった場合（モデル導入直後など）に反映する。
  void updateEngine(ChatEngine engine) {
    _engine = engine;
  }

  /// ユーザー発言を送り、人物の応答をストリーミングで受け取る。
  Future<void> send(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || _isGenerating) return;

    final history = List<ChatMessage>.from(_messages);

    final userMessage = ChatMessage(
      id: _nextId(),
      text: trimmed,
      isUser: true,
      createdAt: DateTime.now(),
    );
    _messages.add(userMessage);

    final replyId = _nextId();
    _messages.add(ChatMessage(
      id: replyId,
      text: '',
      isUser: false,
      createdAt: DateTime.now(),
      isStreaming: true,
    ));

    _isGenerating = true;
    notifyListeners();

    final buffer = StringBuffer();

    void updateReply({bool streaming = true, bool error = false}) {
      final index = _messages.indexWhere((m) => m.id == replyId);
      if (index == -1) return;
      _messages[index] = _messages[index].copyWith(
        text: buffer.toString(),
        isStreaming: streaming,
        isError: error,
      );
      notifyListeners();
    }

    final completer = Completer<void>();

    _subscription = _engine
        .generate(
          figure: figure,
          history: history,
          userMessage: trimmed,
        )
        .listen(
          (chunk) {
            buffer.write(chunk);
            updateReply();
          },
          onError: (Object e) {
            buffer
              ..clear()
              ..write('応答の生成中に問題が発生しました。\n($e)');
            updateReply(streaming: false, error: true);
            _finish();
            if (!completer.isCompleted) completer.complete();
          },
          onDone: () {
            if (buffer.isEmpty) {
              buffer.write('（うまく言葉が出てきませんでした。もう一度試してください。）');
            }
            updateReply(streaming: false);
            _finish();
            if (!completer.isCompleted) completer.complete();
          },
          cancelOnError: true,
        );

    return completer.future;
  }

  /// 生成中の応答を中断する。
  void stop() {
    _subscription?.cancel();
    final index = _messages.indexWhere((m) => m.isStreaming);
    if (index != -1) {
      _messages[index] = _messages[index].copyWith(isStreaming: false);
    }
    _finish();
  }

  void _finish() {
    _isGenerating = false;
    _subscription = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}
