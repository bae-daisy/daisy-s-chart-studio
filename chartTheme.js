// ── 통일 디자인 토큰 ──
const T = {
  bg: '#F8F8F8',
  dark: '#1D1D1F',
  mid: '#7C7C7C',
  track: '#EDEDED',
  accent: '#6C5CE7',
  accentLight: '#A29BFE',
  textBlack: '#1A1A1A',
  textDark: '#454545',
  textMuted: '#959595',
  white: '#FFFFFF',
  divider: '#E8E8E8',
  splitLight: '#CCCCCC',
  font: "'Pretendard', -apple-system, sans-serif",

  W: 1200, H: 750, EDGE: 60,
  TITLE_Y: 44, SUBTITLE_Y: 92,
  LEGEND_Y: 660, SOURCE_Y: 690, FILTER_Y: 710,
  chartTop(sub) { return sub ? 160 : 130; },
  chartBottom() { return 600; },

  SERIES: ['#2D1B69','#3B2A8F','#4F46E5','#6C5CE7','#7C6CF0','#8B7CF6','#9B8DF8','#A29BFE','#B0A8FF','#BDB6FD','#C4B5FD','#D0C9FE','#DDD6FE','#E8E3FF','#EDE9FE','#F3F0FF','#F8F6FF','#FDFCFF'],
  DONUT: ['#1A0F4F','#2D1B69','#3B2A8F','#4F46E5','#6C5CE7','#7C6CF0','#8B7CF6','#A29BFE','#B0A8FF','#C4B5FD','#D0C9FE','#DDD6FE','#E8E3FF','#EDE9FE','#F3F0FF','#F8F6FF'],

  KINDS: {
    line:          { label: '라인 차트',   icon: '📈', category: 'trend' },
    verticalBar:   { label: '세로 바',     icon: '📶', category: 'bar' },
    horizontalBar: { label: '수평 바',     icon: '📊', category: 'bar' },
    donut:         { label: '도넛',        icon: '🍩', category: 'proportion' },
    combo:         { label: '막대+꺾은선', icon: '📉', category: 'trend' },
    bubble:        { label: '버블 비교',  icon: '🫧', category: 'compare' },
    stackedBar:    { label: '누적 막대',  icon: '📊', category: 'proportion' },
    splitBar:      { label: '스플릿 바',  icon: '⚖️', category: 'proportion' },
    scatter:       { label: '분포도',      icon: '🔵', category: 'compare' },
    heatmap:       { label: '히트맵',      icon: '🗺️', category: 'special' },
    table:         { label: '테이블',      icon: '📋', category: 'special' },
    flowCard:      { label: '유입/이탈',   icon: '🔄', category: 'special' },
    venn:          { label: '교차 사용자',  icon: '⭕', category: 'special' },
  },

  KIND_CATEGORIES: {
    trend:      { label: '추세/시계열', icon: '📈', tip: '월별 MAU 추이, 사용시간 변화, 신규 설치 건수 트렌드 등 시간에 따른 변화를 보여줄 때 잘 어울려요' },
    bar:        { label: '막대 차트',   icon: '📊', tip: '사용자 수 순위, 앱별 사용시간 TOP 10, 신규 설치 건수 랭킹 등 항목 간 크기를 비교할 때 잘 어울려요' },
    proportion: { label: '비율/구성',   icon: '🍩', tip: '성별·연령별 사용자 비율, 앱 점유율, 사용 앱 수별 분포 등 전체 대비 구성 비율을 보여줄 때 잘 어울려요' },
    compare:    { label: '비교/분포',   icon: '🔵', tip: '1인당 사용시간 vs 사용일수, 앱별 충성도 비교 등 두 가지 이상 지표를 동시에 비교할 때 잘 어울려요' },
    special:    { label: '특수 차트',   icon: '🧩', tip: '리텐션 히트맵, 유입/이탈 플로우, 교차 사용자 벤 다이어그램 등 특수한 분석 목적에 맞는 차트예요' },
  },

  // 데이터 타입별 추천 차트 매핑
  RECOMMENDED: {
    ranking_users: ['horizontalBar'],
    ranking_time: ['horizontalBar'],
    ranking_avg_time: ['horizontalBar'],
    ranking_devices: ['horizontalBar'],
    ranking_installs: ['horizontalBar'],
    demographic_ranking: ['table'],
    traffic_users: ['line', 'combo'],
    traffic_time: ['line', 'combo'],
    traffic_installs: ['line'],
    industry_demo_users: ['splitBar', 'stackedBar'],
    industry_demo_time: ['splitBar', 'stackedBar'],
    loyalty_distribution: ['donut'],
    churn_analysis: ['table'],
    compare_users: ['line', 'verticalBar'],
    compare_time: ['line', 'verticalBar'],
    compare_avg_time: ['line', 'combo'],
    compare_avg_days: ['line', 'combo'],
    compare_devices: ['line'],
    compare_installs: ['line'],
    demo_compare: ['splitBar'],
    demo_time_compare: ['splitBar'],
    retention_revisit: ['heatmap'],
    retention_delete: ['heatmap'],
    loyalty_compare: ['scatter', 'bubble'],
    flow_in: ['flowCard'],
    flow_out: ['flowCard'],
    flow_retention: ['stackedBar'],
    cross_usage: ['heatmap'],
    cross_users: ['venn'],
  },

  fmt(n, dp) {
    if (dp != null) {
      if (n >= 1e12) return (n/1e12).toFixed(dp)+'조';
      if (n >= 1e8) return (n/1e8).toFixed(dp)+'억';
      if (n >= 1e4) return (n/1e4).toFixed(dp)+'만';
      if (n >= 1e3) return n.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:dp});
      return Number(n).toFixed(dp);
    }
    if (n >= 1e12) return (n/1e12).toFixed(1)+'조';
    if (n >= 1e8) return (n/1e8).toFixed(0)+'억';
    if (n >= 1e4) return (n/1e4).toFixed(0)+'만';
    if (n >= 1e3) return n.toLocaleString();
    return String(Math.round(n));
  },
  fmtTick(v, dp) {
    if (dp != null) {
      if (v >= 1e12) return (v/1e12).toFixed(dp)+'조';
      if (v >= 1e8) return (v/1e8).toFixed(dp)+'억';
      if (v >= 1e4) return (v/1e4).toFixed(dp)+'만';
      return Number(v).toFixed(dp);
    }
    if (v >= 1e12) return (v/1e12).toFixed(1)+'조';
    if (v >= 1e8) return (v/1e8).toFixed(0)+'억';
    if (v >= 1e7) return (v/1e4).toFixed(0)+'만';
    if (v >= 1e4) return (v/1e4).toFixed(1)+'만';
    if (v >= 1e3) return v.toLocaleString();
    return v.toFixed(0);
  },
  isLight(hex) {
    const c = hex.replace('#','');
    if (c.length < 6) return true;
    const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
    return (r*299+g*587+b*114)/1000 > 160;
  }
};
