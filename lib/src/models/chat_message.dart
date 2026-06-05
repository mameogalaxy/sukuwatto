import 'package:flutter/foundation.dart';

/// チャットの1メッセージ。
@immutable
class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.text,
    required this.isUser,
    required this.createdAt,
    this.isStreaming = false,
    this.isError = false,
  });

  /// 一意なID（リスト描画のキー）。
  final String id;

  /// 本文。
  final String text;

  /// true ならユーザー発言、false なら人物（AI）発言。
  final bool isUser;

  final DateTime createdAt;

  /// 生成途中（ストリーミング中）かどうか。タイピング表現に使う。
  final bool isStreaming;

  /// エラー表示用。
  final bool isError;

  ChatMessage copyWith({
    String? text,
    bool? isStreaming,
    bool? isError,
  }) {
    return ChatMessage(
      id: id,
      text: text ?? this.text,
      isUser: isUser,
      createdAt: createdAt,
      isStreaming: isStreaming ?? this.isStreaming,
      isError: isError ?? this.isError,
    );
  }
}
