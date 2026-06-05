# セットアップ手順（開発者向け）

このリポジトリには Flutter アプリの **Dart コード一式** が含まれています。
プラットフォーム（`android/` `ios/`）フォルダはサイズと自動生成の都合で含めていないため、
手元で一度だけ生成する必要があります。以下の手順で「動く状態」になります。

## 0. 必要なもの

- Flutter SDK 3.22 以上（`flutter --version` で確認）
- Android Studio（Android SDK / エミュレータ込み）
- オンデバイスAIを試す場合: RAM 4GB 以上の実機（エミュレータでも可だが遅い）

## 1. プラットフォームフォルダを生成する

リポジトリのルートで、既存の `lib/` を保持したまま platform フォルダだけ生成します。

```bash
flutter create . --org com.example --project-name izanai --platforms=android,ios
```

> `flutter create .` は既存の `lib/` `pubspec.yaml` を上書きしません。
> 足りない `android/` `ios/` 等を補完します。

## 2. 依存を取得

```bash
flutter pub get
```

## 3. Android を flutter_gemma 用に設定

オンデバイス LLM のため、Android 側に最低限の設定が必要です。

### 3-1. `android/app/build.gradle.kts`（または `build.gradle`）

`minSdk` を 24 以上にします。

```kotlin
android {
    defaultConfig {
        minSdk = 24      // flutter_gemma の要件
        // ...
    }
}
```

### 3-2. `android/app/src/main/AndroidManifest.xml`

`<application>` タグに `largeHeap` を付け、モデルDLのため `INTERNET` 権限を追加します。

```xml
<manifest ...>
    <uses-permission android:name="android.permission.INTERNET"/>
    <application
        android:largeHeap="true"
        ... >
```

> 端末によっては GPU バックエンドのために OpenCL の宣言が推奨されます。
> 詳細は flutter_gemma の README を参照してください。

### 3-3. iOS（任意）

`ios/Runner/Info.plist` でメモリ確保のため、必要に応じて設定を追加します。
オンデバイス推論は端末性能に依存します。

## 4. 実行

```bash
flutter run
```

起動直後は **デモ応答モード**（モデル未導入）で UI をひと通り確認できます。

## 5. オンデバイスAIモデルを導入する

1. アプリ内 → ホーム上部のバナー、または「このアプリについて → オンデバイスAIの設定」を開く
2. **MediaPipe LLM 形式（`.task`）の Gemma モデル**のダウンロードURLを入力
   - 例: Hugging Face 上の `gemma-3` 系の `.task`（INT4 量子化）モデル
   - 配布元の **ライセンスに同意**し、必要なら **アクセストークン**を入力
3. 「ダウンロードして導入」を実行 → 完了するとオンデバイスAIに自動で切り替わります

> モデルファイルは数百MB〜になるため Wi-Fi 推奨です。
> ダウンロード後は端末内に保存され、会話時に通信は発生しません。

### 代替: アプリにモデルを同梱する場合

`assets/` にモデルを置き、`pubspec.yaml` の `assets:` に追加したうえで、
`ModelManagerService` に `installModelFromAsset` を使うメソッドを足してください。
（アプリサイズが大きくなり Play Store の上限に影響するため、通常はDL方式を推奨）

## 6. テスト

```bash
flutter test
```

プラグイン非依存の単体テスト（人物データ・プロンプト生成・デモエンジン）が実行されます。

## 7. Play Store 向けビルド

```bash
flutter build appbundle --release
```

リリース前に署名鍵（`key.properties` / keystore）を設定してください。
`.gitignore` で鍵やモデルファイルは除外済みです。

---

## flutter_gemma のバージョンについて

`lib/src/services/gemma_chat_engine.dart` は flutter_gemma **0.9 系**の API を前提にしています。
インストールしたバージョンでストリーミングの戻り型が異なる場合（`String` か `ModelResponse` か）、
`GemmaChatEngine._streamResponse` を調整してください。実装はどちらの型でも動くよう
`dynamic` で受けて分岐しています。
