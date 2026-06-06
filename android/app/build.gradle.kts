plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.mameogalaxy.izanai"
    // flutter_gemma が compileSdk 36 を要求するため明示的に指定。
    compileSdk = 36
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.mameogalaxy.izanai"
        // flutter_gemma（MediaPipe LLM）は minSdk 24 以上が必要。
        minSdk = 24
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // テスト配布用のため debug 鍵で署名（サイドロード可）。
            signingConfig = signingConfigs.getByName("debug")
            // flutter_gemma(MediaPipe) のクラスを R8 が誤って削除し
            // ビルドが失敗するため、コード圧縮を無効化する。
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
