# いざない — 歴史の人物とチャットして学ぶアプリ

歴史上の人物に直接質問することで、「その人が何をして、どの時代に、どんなことを
考えていたのか」を会話を通して学べる Android / iOS アプリです。
相手の応答は **オンデバイスAI**（端末内のLLM）が自動で生成します。

> 旧称: sukuwatto（リポジトリ名）。アプリ表示名は「いざない」。

## コンセプト

- 🗣️ **会話で学ぶ** — 織田信長や紫式部、アインシュタインらに直接きいて理解を深める
- 📱 **オンデバイスAI** — 会話はすべて端末内で生成。通信なしで動き、内容は外部に送られない
- 🎓 **学習目的** — 史実・通説に基づいた応答。授業の予習復習や興味のきっかけに
- 🛒 **ストア対応** — Flutter 製でアプリバンドル（.aab）ビルドに対応

## 技術スタック

| 項目 | 採用 |
| --- | --- |
| フレームワーク | Flutter (Dart) |
| オンデバイスLLM | [flutter_gemma](https://pub.dev/packages/flutter_gemma)（Google Gemma / MediaPipe LLM Inference）|
| 状態管理 | provider |
| 設定保存 | shared_preferences |

## すぐ動く仕組み

巨大なモデルを入れる前でも UI を体験できるよう、**デモ応答エンジン（Mock）** を内蔵しています。
モデルを導入すると自動的にオンデバイスの **Gemma エンジン**へ切り替わります。

```
ChatEngine（抽象）
 ├─ MockChatEngine   … モデル不要のデモ応答（フォールバック）
 └─ GemmaChatEngine  … flutter_gemma によるオンデバイス推論
```

## ディレクトリ構成

```
lib/
  main.dart
  src/
    app.dart                      アプリのルート（DI・テーマ）
    models/                       データモデル（人物・メッセージ）
    data/figures_repository.dart  登場人物のデータと人格プロンプト
    services/                     会話エンジン（Mock / Gemma）とモデル管理
    state/                        AppState・ChatController
    screens/                      ホーム / 人物詳細 / チャット / モデル設定 / About
    widgets/                      カード・吹き出し・入力欄など
test/                            プラグイン非依存の単体テスト
SETUP.md                         実機で動かすまでの手順（重要）
```

## 動かし方（要約）

詳細は **[SETUP.md](SETUP.md)** を参照。

```bash
flutter create . --org com.example --project-name izanai --platforms=android,ios
flutter pub get
flutter run        # まずはデモ応答モードで起動
```

アプリ内の「オンデバイスAIの設定」から Gemma モデル（`.task`）を導入すると、本物のAI会話になります。

## 登場人物（初期収録）

織田信長 / 坂本龍馬 / 紫式部 / アルベルト・アインシュタイン / クレオパトラ7世 /
レオナルド・ダ・ヴィンチ

人物は `lib/src/data/figures_repository.dart` に追加・編集できます。

## 注意

- AIの応答には誤りが含まれることがあります。重要な情報は教科書等でも確認してください。
- 各 Gemma モデルの利用は配布元のライセンスに従ってください。
