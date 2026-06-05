import 'package:flutter/material.dart';

/// チャット下部の入力欄＋送信ボタン。
class MessageComposer extends StatefulWidget {
  const MessageComposer({
    super.key,
    required this.enabled,
    required this.isGenerating,
    required this.onSend,
    required this.onStop,
  });

  /// 入力・送信が可能か。
  final bool enabled;

  /// 生成中なら送信ボタンを停止ボタンに切り替える。
  final bool isGenerating;

  final ValueChanged<String> onSend;
  final VoidCallback onStop;

  @override
  State<MessageComposer> createState() => _MessageComposerState();
}

class _MessageComposerState extends State<MessageComposer> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      final has = _controller.text.trim().isNotEmpty;
      if (has != _hasText) setState(() => _hasText = has);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _submit() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    widget.onSend(text);
    _controller.clear();
    _focusNode.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: _controller,
                focusNode: _focusNode,
                enabled: widget.enabled,
                minLines: 1,
                maxLines: 5,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _submit(),
                decoration: InputDecoration(
                  hintText: widget.enabled ? '質問を入力…' : '準備中です…',
                  filled: true,
                  fillColor: theme.colorScheme.surfaceContainerHighest,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            _ActionButton(
              isGenerating: widget.isGenerating,
              canSend: widget.enabled && _hasText,
              onSend: _submit,
              onStop: widget.onStop,
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.isGenerating,
    required this.canSend,
    required this.onSend,
    required this.onStop,
  });

  final bool isGenerating;
  final bool canSend;
  final VoidCallback onSend;
  final VoidCallback onStop;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (isGenerating) {
      return IconButton.filled(
        onPressed: onStop,
        icon: const Icon(Icons.stop_rounded),
        tooltip: '停止',
        style: IconButton.styleFrom(
          backgroundColor: theme.colorScheme.error,
          foregroundColor: theme.colorScheme.onError,
        ),
      );
    }
    return IconButton.filled(
      onPressed: canSend ? onSend : null,
      icon: const Icon(Icons.send_rounded),
      tooltip: '送信',
    );
  }
}
