import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/historical_figure.dart';
import '../state/app_state.dart';
import '../state/chat_controller.dart';
import '../widgets/chat_bubble.dart';
import '../widgets/message_composer.dart';

/// 1人の人物とのチャット画面。
class ChatScreen extends StatefulWidget {
  const ChatScreen({
    super.key,
    required this.figure,
    this.initialQuestion,
  });

  final HistoricalFigure figure;

  /// 画面を開いた直後に自動送信する質問（おすすめ質問から遷移したとき）。
  final String? initialQuestion;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  late final ChatController _controller;
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    final appState = context.read<AppState>();
    _controller = ChatController(
      figure: widget.figure,
      engine: appState.activeEngine,
    );
    _controller.addListener(_scrollToBottom);

    final initial = widget.initialQuestion;
    if (initial != null && initial.trim().isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _send(initial));
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_scrollToBottom);
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _send(String text) {
    // 送信直前に最新のエンジンへ更新（会話中にモデルが導入されたケースに対応）。
    _controller.updateEngine(context.read<AppState>().activeEngine);
    _controller.send(text);
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent + 120,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final figure = widget.figure;
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            CircleAvatar(
              backgroundColor: figure.accentColor.withValues(alpha: 0.18),
              child: Text(figure.emoji),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(figure.name,
                      style: Theme.of(context).textTheme.titleMedium),
                  Text(
                    '${figure.field} ・ ${figure.lifespanLabel}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color:
                            Theme.of(context).colorScheme.onSurfaceVariant),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListenableBuilder(
              listenable: _controller,
              builder: (context, _) {
                final messages = _controller.messages;
                if (messages.isEmpty) {
                  return _ChatIntro(figure: figure, onPick: _send);
                }
                return ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  itemCount: messages.length,
                  itemBuilder: (context, i) => ChatBubble(
                    message: messages[i],
                    figure: figure,
                  ),
                );
              },
            ),
          ),
          const Divider(height: 1),
          ListenableBuilder(
            listenable: _controller,
            builder: (context, _) {
              return MessageComposer(
                enabled: true,
                isGenerating: _controller.isGenerating,
                onSend: _send,
                onStop: _controller.stop,
              );
            },
          ),
        ],
      ),
    );
  }
}

/// メッセージがまだ無いときの導入表示。おすすめ質問を提示する。
class _ChatIntro extends StatelessWidget {
  const _ChatIntro({required this.figure, required this.onPick});

  final HistoricalFigure figure;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 12),
        Center(
          child: Text(figure.emoji, style: const TextStyle(fontSize: 56)),
        ),
        const SizedBox(height: 12),
        Center(
          child: Text(
            '${figure.name}に話しかけてみましょう',
            style: theme.textTheme.titleMedium,
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: 8),
        Center(
          child: Text(
            figure.tagline,
            style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: 28),
        Text('質問の例',
            style: theme.textTheme.labelLarge
                ?.copyWith(color: theme.colorScheme.primary)),
        const SizedBox(height: 8),
        for (final q in figure.starterQuestions)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                alignment: Alignment.centerLeft,
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: () => onPick(q),
              child: Text(q, textAlign: TextAlign.left),
            ),
          ),
      ],
    );
  }
}
