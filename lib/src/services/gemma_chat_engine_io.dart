import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_gemma/flutter_gemma.dart';

import '../models/chat_message.dart';
import '../models/historical_figure.dart';
import 'chat_engine.dart';

/// flutter_gemma を用いたオンデバイス LLM 推論エンジン（ネイティブ実装）。
///
/// 端末内に導入済み（アクティブ）の Gemma 系モデルを読み込み、
/// すべての推論を端末上で完結させる。ネットワーク送信は行わない。
///
/// flutter_gemma 0.13 系の Modern API（FlutterGemma.getActiveModel 等）に対応。
/// Web ビルドでは本ファイルは使われず [gemma_chat_engine_stub.dart] が選択される
/// （flutter_gemma の推論はネイティブ前提のため）。
class GemmaChatEngine implements ChatEngine {
  GemmaChatEngine({
    this.maxTokens = 1024,
    this.temperature = 0.8,
    this.topK = 40,
  });

  final int maxTokens;
  final double temperature;
  final int topK;

  InferenceModel? _model;
  bool _initializing = false;
  String _status = 'モデル未読み込み';

  @override
  bool get isReady => _model != null;

  @override
  String get statusLabel => _status;

  @override
  Future<void> initialize() async {
    if (_model != null || _initializing) return;
    _initializing = true;
    try {
      if (!FlutterGemma.hasActiveModel()) {
        _status = 'モデルが導入されていません';
        return;
      }
      _status = 'モデルを読み込み中…';
      _model = await FlutterGemma.getActiveModel(
        maxTokens: maxTokens,
        preferredBackend: PreferredBackend.gpu,
      );
      _status = 'オンデバイスAI 準備完了';
    } catch (e) {
      debugPrint('Gemma 初期化エラー: $e');
      _status = 'モデルの読み込みに失敗しました: $e';
      _model = null;
    } finally {
      _initializing = false;
    }
  }

  @override
  Stream<String> generate({
    required HistoricalFigure figure,
    required List<ChatMessage> history,
    required String userMessage,
  }) async* {
    final model = _model;
    if (model == null) {
      throw StateError('モデルが初期化されていません。initialize() を先に呼んでください。');
    }

    final prompt = buildConversationPrompt(
      figure: figure,
      history: history,
      userMessage: userMessage,
    );

    // 会話履歴は prompt 文字列に含めているため、ターンごとに使い捨ての
    // チャットセッションを作って文脈の二重蓄積を防ぐ。
    final chat = await model.createChat(
      temperature: temperature,
      topK: topK,
      randomSeed: DateTime.now().millisecondsSinceEpoch & 0x7fffffff,
    );

    await chat.addQueryChunk(Message.text(text: prompt, isUser: true));

    try {
      yield* _streamResponse(chat);
    } finally {
      await chat.close();
    }
  }

  /// 応答ストリームをトークン断片の Stream<String> に正規化する。
  ///
  /// generateChatResponseAsync() は Stream<ModelResponse> を返す。
  /// TextResponse は `token` を持つ。特定の型に強く依存しないよう dynamic で受ける。
  Stream<String> _streamResponse(InferenceChat chat) async* {
    await for (final dynamic response in chat.generateChatResponseAsync()) {
      if (response == null) continue;
      if (response is String) {
        yield response;
        continue;
      }
      try {
        final dynamic token = response.token;
        if (token is String && token.isNotEmpty) {
          yield token;
        }
      } catch (_) {
        // token を持たない応答（FunctionCall/Thinking など）は無視する。
      }
    }
  }

  @override
  Future<void> dispose() async {
    try {
      await _model?.close();
    } catch (e) {
      debugPrint('Gemma dispose エラー: $e');
    }
    _model = null;
  }
}
