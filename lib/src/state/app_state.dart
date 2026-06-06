import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/chat_engine.dart';
import '../services/gemini_chat_engine.dart';
import '../services/gemma_chat_engine.dart';
import '../services/mock_chat_engine.dart';
import '../services/model_manager_service.dart';

/// アプリ全体で共有する状態。
///
/// どの会話エンジンを使うかを管理する：
///   クラウド(Gemini) > オンデバイス(Gemma) > デモ(Mock) の優先順位。
class AppState extends ChangeNotifier {
  AppState({
    GemmaChatEngine? gemmaEngine,
    MockChatEngine? mockEngine,
    ModelManagerService? modelManager,
  })  : _gemma = gemmaEngine ?? GemmaChatEngine(),
        _mock = mockEngine ?? MockChatEngine(),
        modelManager = modelManager ?? ModelManagerService();

  static const _cloudKeyPref = 'cloud_api_key';
  static const _cloudModelPref = 'cloud_model';

  final GemmaChatEngine _gemma;
  final MockChatEngine _mock;
  final ModelManagerService modelManager;

  GeminiChatEngine? _cloud;

  bool _initialized = false;
  bool get initialized => _initialized;

  /// オンデバイスAI（Gemma）が利用可能か。
  bool get isOnDeviceReady => _gemma.isReady;

  /// クラウドAI（Gemini）が設定済みで利用可能か。
  bool get isCloudReady => _cloud?.isReady ?? false;

  /// 現在設定されているクラウドモデル名（未設定なら null）。
  String? get cloudModel => _cloud?.model;

  /// 現在アクティブな会話エンジン。クラウド > オンデバイス > デモ の順。
  ChatEngine get activeEngine {
    if (_cloud?.isReady ?? false) return _cloud!;
    if (_gemma.isReady) return _gemma;
    return _mock;
  }

  /// 状態表示用ラベル。
  String get engineStatusLabel => activeEngine.statusLabel;

  /// アプリ起動時に呼ぶ。各エンジンを初期化し、保存済み設定を復元する。
  Future<void> init() async {
    if (_initialized) return;
    await _mock.initialize();
    try {
      await modelManager.initialize();
    } catch (e) {
      debugPrint('ModelManager 初期化エラー: $e');
    }
    await _gemma.initialize();
    await _restoreCloud();
    _initialized = true;
    notifyListeners();
  }

  /// モデルの導入状態が変わった後（ダウンロード完了/削除）に呼び、エンジンを再評価する。
  Future<void> refreshOnDeviceEngine() async {
    await _gemma.dispose();
    await _gemma.initialize();
    notifyListeners();
  }

  /// クラウドAI（Gemini）を有効にする。APIキーは端末内にのみ保存される。
  Future<void> enableCloud({
    required String apiKey,
    String model = 'gemini-2.0-flash',
  }) async {
    final key = apiKey.trim();
    _cloud = GeminiChatEngine(apiKey: key, model: model.trim());
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_cloudKeyPref, key);
    await prefs.setString(_cloudModelPref, model.trim());
    notifyListeners();
  }

  /// クラウドAI設定を解除する。
  Future<void> disableCloud() async {
    _cloud = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_cloudKeyPref);
    await prefs.remove(_cloudModelPref);
    notifyListeners();
  }

  Future<void> _restoreCloud() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = prefs.getString(_cloudKeyPref);
      if (key == null || key.trim().isEmpty) return;
      final model = prefs.getString(_cloudModelPref) ?? 'gemini-2.0-flash';
      _cloud = GeminiChatEngine(apiKey: key, model: model);
    } catch (e) {
      debugPrint('クラウド設定の復元に失敗: $e');
    }
  }

  @override
  void dispose() {
    _gemma.dispose();
    _mock.dispose();
    super.dispose();
  }
}
