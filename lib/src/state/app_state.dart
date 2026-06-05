import 'package:flutter/foundation.dart';

import '../services/chat_engine.dart';
import '../services/gemma_chat_engine.dart';
import '../services/mock_chat_engine.dart';
import '../services/model_manager_service.dart';

/// アプリ全体で共有する状態。
///
/// どの会話エンジンを使うか（オンデバイス Gemma かデモ用 Mock か）を管理する。
class AppState extends ChangeNotifier {
  AppState({
    GemmaChatEngine? gemmaEngine,
    MockChatEngine? mockEngine,
    ModelManagerService? modelManager,
  })  : _gemma = gemmaEngine ?? GemmaChatEngine(),
        _mock = mockEngine ?? MockChatEngine(),
        modelManager = modelManager ?? ModelManagerService();

  final GemmaChatEngine _gemma;
  final MockChatEngine _mock;
  final ModelManagerService modelManager;

  bool _initialized = false;
  bool get initialized => _initialized;

  /// オンデバイスAI（Gemma）が利用可能か。
  bool get isOnDeviceReady => _gemma.isReady;

  /// 現在アクティブな会話エンジン。Gemma が使えればそちら、無ければ Mock。
  ChatEngine get activeEngine => _gemma.isReady ? _gemma : _mock;

  /// 状態表示用ラベル。
  String get engineStatusLabel =>
      _gemma.isReady ? _gemma.statusLabel : _mock.statusLabel;

  /// アプリ起動時に呼ぶ。フレームワークを初期化し、モデルが導入済みなら Gemma を有効化する。
  Future<void> init() async {
    if (_initialized) return;
    await _mock.initialize();
    // まずモデル管理（flutter_gemma 初期化＋前回モデルの再アクティブ化）を行い、
    // その後でエンジンを評価する。Web では両方ともダミーで即時完了する。
    try {
      await modelManager.initialize();
    } catch (e) {
      debugPrint('ModelManager 初期化エラー: $e');
    }
    await _gemma.initialize();
    _initialized = true;
    notifyListeners();
  }

  /// モデルの導入状態が変わった後（ダウンロード完了/削除）に呼び、エンジンを再評価する。
  Future<void> refreshOnDeviceEngine() async {
    await _gemma.dispose();
    await _gemma.initialize();
    notifyListeners();
  }

  @override
  void dispose() {
    _gemma.dispose();
    _mock.dispose();
    super.dispose();
  }
}
