import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_gemma/flutter_gemma.dart';

import '../models/chat_message.dart';
import '../models/historical_figure.dart';
import 'chat_engine.dart';

/// flutter_gemma を用いたオンデバイス LLM 推論エンジン。
///
/// 端末内に配置された Gemma 系モデル（.task / .bin）を読み込み、
/// すべての推論を端末上で完結させる。ネットワーク送信は行わない。
///
/// 注意:
///   このコードは flutter_gemma 0.9 系の API を前提にしている。
///   インストールしたバージョンで型名やメソッドが異なる場合は、
///   下の [_streamResponse] のストリーミング処理部分を調整すること
///   （README の「オンデバイスAIの組み込み」を参照）。
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

  /// 端末にモデルが導入済みかを返す。
  Future<bool> isModelInstalled() async {
    try {
      return await FlutterGemmaPlugin.instance.modelManager.isModelInstalled;
    } catch (e) {
      debugPrint('isModelInstalled エラー: $e');
      return false;
    }
  }

  @override
  Future<void> initialize() async {
    if (_model != null || _initializing) return;
    _initializing = true;
    try {
      final installed = await isModelInstalled();
      if (!installed) {
        _status = 'モデルが導入されていません';
        return;
      }
      _status = 'モデルを読み込み中…';
      _model = await FlutterGemmaPlugin.instance.createModel(
        modelType: ModelType.gemmaIt,
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

    yield* _streamResponse(chat);
  }

  /// 応答ストリームをトークン断片の Stream<String> に正規化する。
  ///
  /// flutter_gemma のバージョンによって yield される型が ModelResponse
  /// （TextResponse 等）か String かで異なる。特定の型に依存しないよう、
  /// dynamic で受けて文字列を取り出す（ダックタイピング）。
  Stream<String> _streamResponse(InferenceChat chat) async* {
    await for (final dynamic response in chat.generateChatResponseAsync()) {
      if (response == null) continue;
      if (response is String) {
        yield response;
        continue;
      }
      // ModelResponse 系: TextResponse は `token` を持つ。
      try {
        final dynamic token = response.token;
        if (token is String && token.isNotEmpty) {
          yield token;
        }
      } catch (_) {
        // token を持たない型（FunctionCallResponse など）は無視する。
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
