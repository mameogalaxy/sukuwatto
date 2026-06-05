import 'package:flutter/material.dart';

/// 歴史上の人物を表すモデル。
///
/// チャット相手としての「人格(systemPrompt)」と、学習用のプロフィール情報
/// (生没年・分野・地域・略歴・おすすめ質問)を併せ持つ。
@immutable
class HistoricalFigure {
  const HistoricalFigure({
    required this.id,
    required this.name,
    required this.reading,
    required this.emoji,
    this.portraitAsset,
    required this.field,
    required this.region,
    required this.birthYear,
    this.deathYear,
    required this.tagline,
    required this.bio,
    required this.systemPrompt,
    required this.starterQuestions,
    required this.accentColor,
  });

  /// 一意な識別子（チャット履歴の保存キーにも使う）。
  final String id;

  /// 表示名（例: 織田信長）。
  final String name;

  /// 読み仮名（例: おだ のぶなが）。
  final String reading;

  /// アバターとして使う絵文字。肖像が無い場合のフォールバック。
  final String emoji;

  /// 人物のオリジナル肖像（自作 SVG）のアセットパス。null の場合は [emoji] を使う。
  ///
  /// 写真や既存の肖像画を複製せず、その人物・時代を象徴する非写実のイラストとして
  /// 用意している（肖像権・著作権に配慮）。
  final String? portraitAsset;

  /// 主な分野（例: 武将 / 物理学者）。
  final String field;

  /// 活躍した地域・国。
  final String region;

  /// 生年（西暦）。
  final int birthYear;

  /// 没年（西暦）。存命や不明の場合は null。
  final int? deathYear;

  /// 一言キャッチコピー。一覧カードで使う。
  final String tagline;

  /// 学習用の略歴（数文）。
  final String bio;

  /// LLM に与える人格設定プロンプト。なりきり方・口調・知識・守るべき制約を含む。
  final String systemPrompt;

  /// チャット開始時に提示するおすすめ質問。学習のきっかけになる。
  final List<String> starterQuestions;

  /// テーマ色。
  final Color accentColor;

  /// 「1582」や「紀元前69 - 紀元前30」のような生没年の表示文字列。
  String get lifespanLabel {
    String fmt(int year) =>
        year < 0 ? '紀元前${year.abs()}' : '$year';
    final birth = fmt(birthYear);
    if (deathYear == null) return '$birth年 - ';
    return '$birth - ${fmt(deathYear!)}';
  }
}
