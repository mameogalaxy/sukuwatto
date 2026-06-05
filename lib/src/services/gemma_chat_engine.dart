// GemmaChatEngine のエントリ。
//
// flutter_gemma は Android/iOS/デスクトップに加え Web（WebGPU）にも対応しているため、
// 実装（_io）を全プラットフォーム共通で用いる。モデル未導入時は AppState 側で
// デモ応答（MockChatEngine）にフォールバックする。
export 'gemma_chat_engine_io.dart';
