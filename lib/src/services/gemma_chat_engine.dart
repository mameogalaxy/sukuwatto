// プラットフォームに応じて GemmaChatEngine の実装を切り替えるエントリ。
//
// - ネイティブ（Android/iOS/デスクトップ: dart:io あり）→ flutter_gemma 実装
// - Web（dart:io なし）→ ダミー実装（オンデバイスAI無効、デモ応答にフォールバック）
//
// 利用側は常に `gemma_chat_engine.dart` を import すればよい。
export 'gemma_chat_engine_stub.dart'
    if (dart.library.io) 'gemma_chat_engine_io.dart';
