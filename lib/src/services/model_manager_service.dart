// プラットフォームに応じて ModelManagerService の実装を切り替えるエントリ。
//
// - ネイティブ（dart:io あり）→ flutter_gemma を使う実装
// - Web（dart:io なし）→ ダミー実装（ダウンロード未対応）
//
// 利用側は常に `model_manager_service.dart` を import すればよい。
export 'model_manager_service_stub.dart'
    if (dart.library.io) 'model_manager_service_io.dart';
