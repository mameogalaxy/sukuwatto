import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../models/historical_figure.dart';

/// 人物のオリジナル肖像を円形で表示するアバター。
///
/// [speaking] が true のとき、外周がやさしく脈打ち「その人物が話している」演出になる。
/// 肖像（SVG）が無い人物は絵文字にフォールバックする。
class FigurePortrait extends StatefulWidget {
  const FigurePortrait({
    super.key,
    required this.figure,
    this.size = 56,
    this.speaking = false,
    this.showRing = true,
  });

  final HistoricalFigure figure;
  final double size;

  /// 応答生成中（話している）かどうか。
  final bool speaking;

  /// アクセント色のリングを表示するか。
  final bool showRing;

  @override
  State<FigurePortrait> createState() => _FigurePortraitState();
}

class _FigurePortraitState extends State<FigurePortrait>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  );

  @override
  void initState() {
    super.initState();
    if (widget.speaking) _controller.repeat(reverse: true);
  }

  @override
  void didUpdateWidget(covariant FigurePortrait oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.speaking && !_controller.isAnimating) {
      _controller.repeat(reverse: true);
    } else if (!widget.speaking && _controller.isAnimating) {
      _controller.stop();
      _controller.value = 0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final accent = widget.figure.accentColor;
    final size = widget.size;

    final portrait = ClipOval(
      child: SizedBox(
        width: size,
        height: size,
        child: widget.figure.portraitAsset != null
            ? SvgPicture.asset(
                widget.figure.portraitAsset!,
                fit: BoxFit.cover,
                placeholderBuilder: (_) => _EmojiFallback(
                    emoji: widget.figure.emoji, color: accent, size: size),
              )
            : _EmojiFallback(
                emoji: widget.figure.emoji, color: accent, size: size),
      ),
    );

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = _controller.value;
        return Container(
          width: size + 8,
          height: size + 8,
          alignment: Alignment.center,
          decoration: widget.showRing
              ? BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: accent.withValues(alpha: 0.55),
                    width: 2,
                  ),
                  boxShadow: widget.speaking
                      ? [
                          BoxShadow(
                            color: accent.withValues(alpha: 0.25 + 0.35 * t),
                            blurRadius: 6 + 12 * t,
                            spreadRadius: 1 + 3 * t,
                          ),
                        ]
                      : null,
                )
              : null,
          child: child,
        );
      },
      child: portrait,
    );
  }
}

class _EmojiFallback extends StatelessWidget {
  const _EmojiFallback({
    required this.emoji,
    required this.color,
    required this.size,
  });

  final String emoji;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      color: color.withValues(alpha: 0.15),
      alignment: Alignment.center,
      child: Text(emoji, style: TextStyle(fontSize: size * 0.5)),
    );
  }
}
