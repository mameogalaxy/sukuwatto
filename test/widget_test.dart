import 'package:flutter_test/flutter_test.dart';

import 'package:izanai/src/data/figures_repository.dart';
import 'package:izanai/src/models/chat_message.dart';
import 'package:izanai/src/services/chat_engine.dart';
import 'package:izanai/src/services/mock_chat_engine.dart';

// ここではプラットフォームプラグイン（flutter_gemma）に依存しない範囲を検証する。
// オンデバイス推論の動作確認は実機/エミュレータで行うこと（SETUP.md 参照）。
void main() {
  group('FiguresRepository', () {
    const repo = FiguresRepository();

    test('人物が登録されている', () {
      expect(repo.all(), isNotEmpty);
    });

    test('id で人物を取得できる', () {
      final first = repo.all().first;
      expect(repo.byId(first.id).name, first.name);
    });

    test('すべての人物が必須項目を持つ', () {
      for (final f in repo.all()) {
        expect(f.id, isNotEmpty);
        expect(f.name, isNotEmpty);
        expect(f.systemPrompt.trim(), isNotEmpty);
        expect(f.starterQuestions, isNotEmpty);
      }
    });

    test('生没年ラベルが整形される（紀元前を含む）', () {
      final cleopatra = repo.byId('cleopatra');
      expect(cleopatra.lifespanLabel, contains('紀元前'));
    });
  });

  group('buildConversationPrompt', () {
    test('人格プロンプトとユーザー発言を含む', () {
      const repo = FiguresRepository();
      final figure = repo.all().first;
      final prompt = buildConversationPrompt(
        figure: figure,
        history: const [],
        userMessage: 'こんにちは',
      );
      expect(prompt, contains(figure.name));
      expect(prompt, contains('こんにちは'));
    });

    test('過去の会話履歴を反映する', () {
      const repo = FiguresRepository();
      final figure = repo.all().first;
      final history = [
        ChatMessage(
          id: '1',
          text: '前の質問',
          isUser: true,
          createdAt: DateTime(2024),
        ),
      ];
      final prompt = buildConversationPrompt(
        figure: figure,
        history: history,
        userMessage: '次の質問',
      );
      expect(prompt, contains('前の質問'));
      expect(prompt, contains('次の質問'));
    });
  });

  group('MockChatEngine', () {
    test('応答をストリーミングして空でない文字列を返す', () async {
      final engine = MockChatEngine();
      await engine.initialize();
      expect(engine.isReady, isTrue);

      const repo = FiguresRepository();
      final figure = repo.all().first;

      final chunks = <String>[];
      await for (final c in engine.generate(
        figure: figure,
        history: const <ChatMessage>[],
        userMessage: 'テスト',
      )) {
        chunks.add(c);
      }
      expect(chunks.join(), isNotEmpty);
      expect(chunks.join(), contains(figure.name));
    });
  });
}
