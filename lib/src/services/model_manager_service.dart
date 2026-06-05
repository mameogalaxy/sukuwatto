// ModelManagerService のエントリ。
//
// flutter_gemma は Web（WebGPU）にも対応しているため、実装（_io）を全プラットフォーム
// 共通で用いる。Web ではモデルはブラウザのキャッシュ/OPFS に保存される。
export 'model_manager_service_io.dart';
