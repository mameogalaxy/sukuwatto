import 'package:flutter/material.dart';

import '../models/chat_message.dart';
import '../models/historical_figure.dart';
import 'figure_portrait.dart';
import 'typing_indicator.dart';

/// 1メッセージの吹き出し。
class ChatBubble extends StatelessWidget {
  const ChatBubble({
    super.key,
    required this.message,
    required this.figure,
  });

  final ChatMessage message;
  final HistoricalFigure figure;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isUser = message.isUser;

    final bubbleColor = isUser
        ? theme.colorScheme.primary
        : (message.isError
            ? theme.colorScheme.errorContainer
            : theme.colorScheme.surfaceContainerHighest);
    final textColor = isUser
        ? theme.colorScheme.onPrimary
        : (message.isError
            ? theme.colorScheme.onErrorContainer
            : theme.colorScheme.onSurface);

    final showTyping = message.isStreaming && message.text.isEmpty;

    final bubble = Container(
      constraints: BoxConstraints(
        maxWidth: MediaQuery.sizeOf(context).width * 0.75,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: bubbleColor,
        borderRadius: BorderRadius.only(
          topLeft: const Radius.circular(16),
          topRight: const Radius.circular(16),
          bottomLeft: Radius.circular(isUser ? 16 : 4),
          bottomRight: Radius.circular(isUser ? 4 : 16),
        ),
      ),
      child: showTyping
          ? TypingIndicator(color: textColor.withValues(alpha: 0.6))
          : SelectableText(
              message.text,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: textColor,
                height: 1.4,
              ),
            ),
    );

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 12),
      child: Row(
        mainAxisAlignment:
            isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isUser) ...[
            FigurePortrait(
              figure: figure,
              size: 34,
              showRing: false,
              speaking: message.isStreaming,
            ),
            const SizedBox(width: 8),
          ],
          Flexible(child: bubble),
        ],
      ),
    );
  }
}
