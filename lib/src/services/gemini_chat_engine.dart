import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../models/chat_message.dart';
import '../models/historical_figure.dart';
import 'chat_engine.dart';

/// クラウドAI（Google Gemini）を使う会話エンジン。
///
/// オンデバイスと違い、WebGPU や大きなモデルのダウンロードが不要で、
/// iPhone の Safari を含むあらゆる端末で動く。会話内容は Google のサーバーへ送信される。
///
/// 無料の API キーは Google AI Studio (https://aistudio.google.com/apikey) で取得できる。
class GeminiChatEngine implements ChatEngine {
  GeminiChatEngine({
    required this.apiKey,
    this.model = 'gemini-2.5-flash',
    this.temperature = 0.8,
  });

  final String apiKey;
  final String model;
  final double temperature;

  /// API キーで「generateContent に対応した利用可能なモデル名」一覧を取得する。
  ///
  /// モデル名はバージョンや無料枠の都合で変わるため、固定せず実環境から取得する。
  static Future<List<String>> listModels(String apiKey) async {
    final uri = Uri.parse(
      'https://generativelanguage.googleapis.com/v1beta/models'
      '?pageSize=200&key=${apiKey.trim()}',
    );
    final resp = await http.get(uri);
    if (resp.statusCode != 200) {
      throw Exception('モデル一覧の取得に失敗 (${resp.statusCode})');
    }
    final data = jsonDecode(utf8.decode(resp.bodyBytes)) as Map<String, dynamic>;
    final models = (data['models'] as List<dynamic>?) ?? const [];
    final result = <String>[];
    for (final m in models) {
      final mm = m as Map<String, dynamic>;
      final methods =
          (mm['supportedGenerationMethods'] as List<dynamic>?)?.cast<String>() ??
              const [];
      if (!methods.contains('generateContent')) continue;
      var name = (mm['name'] as String?) ?? '';
      if (name.startsWith('models/')) name = name.substring(7);
      // 画像/音声/TTS等の特殊モデルは会話用途では除外（チャット向けに絞る）。
      if (name.contains('embedding') ||
          name.contains('imagen') ||
          name.contains('tts') ||
          name.contains('image')) {
        continue;
      }
      if (name.isNotEmpty) result.add(name);
    }
    // 新しめ・flash系を上に。
    result.sort((a, b) {
      int score(String s) =>
          (s.contains('flash') ? -2 : 0) + (s.contains('2.5') ? -1 : 0);
      return score(a).compareTo(score(b));
    });
    return result;
  }

  @override
  bool get isReady => apiKey.trim().isNotEmpty;

  @override
  String get statusLabel =>
      isReady ? 'クラウドAI（Gemini・$model）で会話中' : 'APIキーが未設定です';

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
    final uri = Uri.parse(
      'https://generativelanguage.googleapis.com/v1beta/models/'
      '$model:generateContent?key=$apiKey',
    );

    final contents = <Map<String, dynamic>>[];
    for (final m in history) {
      if (m.isError || m.text.trim().isEmpty) continue;
      contents.add({
        'role': m.isUser ? 'user' : 'model',
        'parts': [
          {'text': m.text}
        ],
      });
    }
    contents.add({
      'role': 'user',
      'parts': [
        {'text': userMessage}
      ],
    });

    final body = jsonEncode({
      'systemInstruction': {
        'parts': [
          {'text': figure.systemPrompt.trim()}
        ]
      },
      'contents': contents,
      'generationConfig': {
        'temperature': temperature,
        'maxOutputTokens': 1024,
      },
    });

    http.Response resp;
    try {
      resp = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: body,
      );
    } catch (e) {
      throw Exception('通信に失敗しました。ネット接続をご確認ください。($e)');
    }

    if (resp.statusCode != 200) {
      throw Exception(
          'Gemini APIエラー (${resp.statusCode})：${_briefError(resp.body)}');
    }

    final text = _extractText(utf8.decode(resp.bodyBytes));
    if (text.trim().isEmpty) {
      throw Exception('応答が空でした（内容がブロックされた可能性があります）。');
    }

    // サーバーは一括応答のため、それらしく1〜2文字ずつ流して表示する。
    final buffer = StringBuffer();
    for (var i = 0; i < text.length; i++) {
      buffer.write(text[i]);
      if (i % 2 == 1) {
        yield buffer.toString();
        buffer.clear();
        await Future<void>.delayed(const Duration(milliseconds: 10));
      }
    }
    if (buffer.isNotEmpty) yield buffer.toString();
  }

  String _extractText(String responseBody) {
    try {
      final data = jsonDecode(responseBody) as Map<String, dynamic>;
      final candidates = data['candidates'] as List<dynamic>?;
      if (candidates == null || candidates.isEmpty) return '';
      final content = candidates.first['content'] as Map<String, dynamic>?;
      final parts = content?['parts'] as List<dynamic>?;
      if (parts == null) return '';
      final buffer = StringBuffer();
      for (final p in parts) {
        final t = (p as Map<String, dynamic>)['text'];
        if (t is String) buffer.write(t);
      }
      return buffer.toString();
    } catch (e) {
      debugPrint('Gemini 応答の解析に失敗: $e');
      return '';
    }
  }

  String _briefError(String body) {
    try {
      final data = jsonDecode(body) as Map<String, dynamic>;
      final msg = (data['error'] as Map<String, dynamic>?)?['message'];
      if (msg is String) return msg;
    } catch (_) {}
    return body.length > 200 ? '${body.substring(0, 200)}…' : body;
  }
}
