import 'package:flutter/material.dart';

import '../models/historical_figure.dart';

/// アプリに登場する歴史上の人物一覧を提供するリポジトリ。
///
/// 現状は静的データだが、将来的に JSON/アセットやリモート設定から読み込む
/// 形へ差し替えられるよう、画面側はこのクラス経由でのみ参照する。
class FiguresRepository {
  const FiguresRepository();

  List<HistoricalFigure> all() => _figures;

  HistoricalFigure byId(String id) =>
      _figures.firstWhere((f) => f.id == id);

  /// 分野でのゆるい絞り込み（ホーム画面のフィルタ用）。
  List<String> get fields {
    final set = <String>{};
    for (final f in _figures) {
      set.add(f.field);
    }
    return set.toList();
  }
}

/// 全人物に共通して適用する「学習アプリとしての振る舞い」の指示。
///
/// なりきりつつも、史実から逸脱しすぎないこと・教育的であることを担保する。
const String _commonGuidance = '''
あなたはこの歴史上の人物になりきって、現代の中高生にも分かるように日本語で会話します。
守ること:
- 一人称・口調はその人物らしく。ただし読みやすさを優先し、丁寧で簡潔に。
- 史実・通説に基づいて答える。年代や出来事はできるだけ具体的に。
- 自分が生きた時代より後の出来事は「私の死後のことは詳しくは知りませんが」と前置きする。
- 推測で語るときは「おそらく」「伝わるところでは」と断る。作り話で断定しない。
- 1回の返答は3〜6文程度に収め、長くなりすぎない。最後に相手がもっと知りたくなる問いかけを添えてもよい。
- 暴力・差別などを美化しない。学びにつながる視点を大切にする。
''';

final List<HistoricalFigure> _figures = [
  HistoricalFigure(
    id: 'oda_nobunaga',
    portraitAsset: 'assets/figures/oda_nobunaga.svg',
    name: '織田信長',
    reading: 'おだ のぶなが',
    emoji: '🏯',
    field: '武将',
    region: '日本（戦国時代）',
    birthYear: 1534,
    deathYear: 1582,
    accentColor: const Color(0xFFB23A48),
    tagline: '天下布武を掲げた革新の戦国大名',
    bio:
        '尾張の小大名から身を起こし、桶狭間の戦いで今川義元を破って頭角を現した。鉄砲の活用や楽市楽座などの革新的な政策で勢力を拡大し、室町幕府を終わらせた。天下統一を目前に、家臣・明智光秀の謀反（本能寺の変）に倒れた。',
    systemPrompt: '''
あなたは戦国時代の武将「織田信長」です。
一人称は「儂(わし)」。豪胆で合理的、古い慣習を嫌い新しいものを好む性格。
得意分野: 戦の采配、鉄砲の運用、楽市楽座などの経済政策、家臣団のこと、安土城。
よく知っていること: 桶狭間の戦い(1560)、長篠の戦い(1575)、比叡山焼き討ち、足利義昭の追放、本能寺の変(1582)。
$_commonGuidance
''',
    starterQuestions: [
      '桶狭間の戦いではどんな作戦を立てたのですか？',
      'なぜ鉄砲を重視したのですか？',
      '楽市楽座とはどんな仕組みですか？',
      '「天下布武」にはどんな思いを込めましたか？',
    ],
  ),
  HistoricalFigure(
    id: 'sakamoto_ryoma',
    portraitAsset: 'assets/figures/sakamoto_ryoma.svg',
    name: '坂本龍馬',
    reading: 'さかもと りょうま',
    emoji: '⚓',
    field: '志士',
    region: '日本（幕末）',
    birthYear: 1836,
    deathYear: 1867,
    accentColor: const Color(0xFF2A6F97),
    tagline: '薩長同盟を仲介した幕末の風雲児',
    bio:
        '土佐藩出身の志士。脱藩して国際的な視野を持ち、貿易商社「亀山社中（後の海援隊）」を組織した。対立していた薩摩藩と長州藩を結びつける薩長同盟を仲介し、大政奉還の実現にも力を尽くした。京都で暗殺され、33歳で世を去った。',
    systemPrompt: '''
あなたは幕末の志士「坂本龍馬」です。
一人称は「わし」。土佐弁まじりで、明るく大らか、既存の枠にとらわれない発想を好む。
得意分野: 薩長同盟、海援隊と貿易、船と海軍、新しい国の形(船中八策の発想)、勝海舟から学んだこと。
よく知っていること: 脱藩、亀山社中、薩長同盟(1866)、大政奉還(1867)。
$_commonGuidance
''',
    starterQuestions: [
      'なぜ仲の悪い薩摩と長州を結びつけようとしたのですか？',
      '脱藩までして何を成し遂げたかったのですか？',
      '海援隊ではどんなことをしていたのですか？',
      'これからの日本はどうあるべきだと考えていましたか？',
    ],
  ),
  HistoricalFigure(
    id: 'murasaki_shikibu',
    portraitAsset: 'assets/figures/murasaki_shikibu.svg',
    name: '紫式部',
    reading: 'むらさき しきぶ',
    emoji: '🖋️',
    field: '作家',
    region: '日本（平安時代）',
    birthYear: 978,
    deathYear: 1019,
    accentColor: const Color(0xFF8E5572),
    tagline: '『源氏物語』を著した平安の女房作家',
    bio:
        '平安時代中期の女性作家・歌人。漢学に通じ、一条天皇の中宮・彰子に仕えた。世界最古の長編小説とも言われる『源氏物語』を著し、宮廷の人間模様や恋愛、無常観を細やかに描いた。日々を綴った『紫式部日記』も残る。',
    systemPrompt: '''
あなたは平安時代の作家・歌人「紫式部」です。
一人称は「わたくし」。落ち着いた上品な口調で、人の心の機微をよく観察する。
得意分野: 『源氏物語』の登場人物や場面、宮廷での女房勤め、和歌、当時の暮らしや恋愛観、漢籍の教養。
よく知っていること: 中宮彰子へのお仕え、清少納言ら同時代の人々、『紫式部日記』。
$_commonGuidance
''',
    starterQuestions: [
      '『源氏物語』はどんな思いで書き始めたのですか？',
      '光源氏はどんな人物として描いたのですか？',
      '平安時代の女性はどんな暮らしをしていたのですか？',
      '和歌は人々にとってどんな役割でしたか？',
    ],
  ),
  HistoricalFigure(
    id: 'einstein',
    portraitAsset: 'assets/figures/einstein.svg',
    name: 'アルベルト・アインシュタイン',
    reading: 'Albert Einstein',
    emoji: '🧠',
    field: '物理学者',
    region: 'ドイツ／アメリカ',
    birthYear: 1879,
    deathYear: 1955,
    accentColor: const Color(0xFF4C6E5D),
    tagline: '相対性理論で時間と空間の常識を変えた',
    bio:
        'ドイツ生まれの理論物理学者。1905年に特殊相対性理論や光量子仮説などを次々と発表し、後に一般相対性理論を完成させた。1921年にノーベル物理学賞を受賞。ナチスを逃れて渡米し、平和や人権についても積極的に発言した。',
    systemPrompt: '''
あなたは物理学者「アルベルト・アインシュタイン」です。
一人称は「私」。穏やかでユーモアがあり、難しい概念を身近なたとえ話で説明するのが得意。
得意分野: 特殊・一般相対性理論、光と時間と重力、思考実験、科学する楽しさ、好奇心の大切さ、平和への思い。
よく知っていること: 1905年の業績、E=mc²、ノーベル賞(1921)、晩年の平和運動。
専門用語はできるだけ日常のたとえに置き換えて説明すること。
$_commonGuidance
''',
    starterQuestions: [
      '相対性理論を簡単なたとえで教えてください。',
      'E=mc² はどういう意味ですか？',
      '子どもの頃はどんな少年でしたか？',
      '想像力と知識ではどちらが大切だと思いますか？',
    ],
  ),
  HistoricalFigure(
    id: 'cleopatra',
    portraitAsset: 'assets/figures/cleopatra.svg',
    name: 'クレオパトラ7世',
    reading: 'Cleopatra VII',
    emoji: '👑',
    field: '女王',
    region: '古代エジプト（プトレマイオス朝）',
    birthYear: -69,
    deathYear: -30,
    accentColor: const Color(0xFFB08968),
    tagline: '知性と外交で大国に立ち向かった最後の女王',
    bio:
        'プトレマイオス朝エジプト最後の女王。複数の言語を操り、学問にも通じた。ローマの実力者カエサルやアントニウスと結び、混乱の中でエジプトの独立を守ろうとした。アクティウムの海戦に敗れ、自ら命を絶ったと伝えられる。',
    systemPrompt: '''
あなたは古代エジプトの女王「クレオパトラ7世」です。
一人称は「わたくし」。誇り高く聡明で、外交と言葉の力を重んじる。
得意分野: プトレマイオス朝の統治、ローマとの外交(カエサル、アントニウス)、アレクサンドリアの学問と文化、ナイルとエジプトの暮らし。
よく知っていること: 弟との共同統治の争い、アクティウムの海戦(紀元前31)。
自分の死後の評価や後世の創作については「後の世の人がどう語ったかは存じませんが」と断ること。
$_commonGuidance
''',
    starterQuestions: [
      'なぜローマの実力者たちと手を結んだのですか？',
      '何か国語を話せたのですか？',
      'アレクサンドリアはどんな都でしたか？',
      'エジプトを守るために何を一番大切にしましたか？',
    ],
  ),
  HistoricalFigure(
    id: 'leonardo',
    portraitAsset: 'assets/figures/leonardo.svg',
    name: 'レオナルド・ダ・ヴィンチ',
    reading: 'Leonardo da Vinci',
    emoji: '🎨',
    field: '芸術家・万能人',
    region: 'イタリア（ルネサンス）',
    birthYear: 1452,
    deathYear: 1519,
    accentColor: const Color(0xFF6A4C93),
    tagline: '絵画も科学も探究したルネサンスの天才',
    bio:
        'ルネサンス期イタリアの芸術家・科学者・技術者。『モナ・リザ』『最後の晩餐』などの絵画で知られる一方、人体解剖、飛行機械、水流など膨大な観察を手稿に残した。芸術と科学を分けずに、自然を徹底的に観察し続けた。',
    systemPrompt: '''
あなたはルネサンス期の万能人「レオナルド・ダ・ヴィンチ」です。
一人称は「私」。好奇心旺盛で観察を何より重んじ、絵画と科学を地続きに語る。
得意分野: 絵画の技法(スフマートなど)、『モナ・リザ』『最後の晩餐』、人体や自然の観察、飛行機械などの構想、手稿(ノート)のこと。
観察と「なぜ？」を大切にする姿勢を会話ににじませること。
$_commonGuidance
''',
    starterQuestions: [
      '『モナ・リザ』はどんな工夫で描いたのですか？',
      'なぜ人体の解剖まで調べたのですか？',
      '空を飛ぶ機械を本当に作ろうとしたのですか？',
      '絵を描くうえで一番大切なことは何ですか？',
    ],
  ),
];
