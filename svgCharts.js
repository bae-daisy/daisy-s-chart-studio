// ── SVG 차트 렌더러 (모두 1200×750 SVG) ──
const SvgCharts = {

  // 공통: SVG 컨테이너 + 타이틀 + 부제목 + 출처

  // ── 교차 사용자 벤 다이어그램 ──
  venn(title, subtitle, source, app1, app2, crossCount) {
    var W = T.W, H = T.H;
    var cTop = T.chartTop(!!subtitle);
    var cBot = 645;
    var uid = Date.now();
    var statsX = 655;
    var statsW = W - T.EDGE - statsX;
    var vennCX = Math.round((T.EDGE + statsX - 40) / 2);  // ~338
    var vennCY = Math.round(cTop + (cBot - cTop) / 2);
    var r = 148;   // 원 반지름
    var d = 210;   // 두 원 중심 거리 (겹침 적당히 조절)
    var cx1 = vennCX - Math.round(d / 2);   // 왼쪽 원 중심 x
    var cx2 = vennCX + Math.round(d / 2);   // 오른쪽 원 중심 x
    // 전용 영역 중앙 = vennCX ± r
    var leftLabelX  = vennCX - r;   // 왼쪽 전용 영역 수평 중앙
    var rightLabelX = vennCX + r;   // 오른쪽 전용 영역 수평 중앙
    var midLabelX   = vennCX;       // 교집합 중앙
    var self = this;

    function fmtW(n) {
      if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
      if (n >= 1e4) return Math.round(n / 1e4) + '만';
      return Math.round(n).toLocaleString();
    }

    var svg = '';
    svg += '<defs>';
    svg += '<clipPath id="vc-' + uid + '"><circle cx="' + cx1 + '" cy="' + vennCY + '" r="' + r + '"/></clipPath>';
    var iconR = 32;
    var iconCY = vennCY - 24;
    var numY = vennCY + 50;
    svg += '<clipPath id="ic1-' + uid + '"><circle cx="' + leftLabelX + '" cy="' + iconCY + '" r="' + iconR + '"/></clipPath>';
    svg += '<clipPath id="ic2-' + uid + '"><circle cx="' + rightLabelX + '" cy="' + iconCY + '" r="' + iconR + '"/></clipPath>';
    svg += '</defs>';

    svg += '<circle cx="' + cx1 + '" cy="' + vennCY + '" r="' + r + '" fill="rgba(168,155,254,0.22)"/>';
    svg += '<circle cx="' + cx2 + '" cy="' + vennCY + '" r="' + r + '" fill="rgba(168,155,254,0.22)"/>';
    svg += '<circle cx="' + cx2 + '" cy="' + vennCY + '" r="' + r + '" clip-path="url(#vc-' + uid + ')" fill="rgba(108,92,231,0.52)"/>';

    // 왼쪽 앱: 아이콘 (크게) + 수치 아래
    var icon1 = this._appIcon(app1.pkg);
    var bg1 = (app1.pkg === 'com.netflix.mediaclient') ? '#000' : '#FFF';
    svg += '<circle cx="' + leftLabelX + '" cy="' + iconCY + '" r="' + iconR + '" fill="' + bg1 + '" stroke="' + T.divider + '" stroke-width="1.5"/>';
    if (icon1) {
      svg += '<image href="' + icon1 + '" x="' + (leftLabelX - iconR) + '" y="' + (iconCY - iconR) + '" width="' + (iconR*2) + '" height="' + (iconR*2) + '" clip-path="url(#ic1-' + uid + ')" preserveAspectRatio="xMidYMid slice"/>';
    } else {
      svg += '<text x="' + leftLabelX + '" y="' + (iconCY + 8) + '" text-anchor="middle" font-size="24" font-weight="700" fill="' + (bg1 === '#000' ? '#FFF' : T.dark) + '">' + app1.name.charAt(0) + '</text>';
    }
    svg += '<text x="' + leftLabelX + '" y="' + numY + '" text-anchor="middle" font-size="28" font-weight="700" fill="' + T.textBlack + '">' + fmtW(app1.onlyUsers) + '</text>';

    // 오른쪽 앱: 아이콘 (크게) + 수치 아래
    var icon2 = this._appIcon(app2.pkg);
    var bg2 = (app2.pkg === 'com.netflix.mediaclient') ? '#000' : '#FFF';
    svg += '<circle cx="' + rightLabelX + '" cy="' + iconCY + '" r="' + iconR + '" fill="' + bg2 + '" stroke="' + T.divider + '" stroke-width="1.5"/>';
    if (icon2) {
      svg += '<image href="' + icon2 + '" x="' + (rightLabelX - iconR) + '" y="' + (iconCY - iconR) + '" width="' + (iconR*2) + '" height="' + (iconR*2) + '" clip-path="url(#ic2-' + uid + ')" preserveAspectRatio="xMidYMid slice"/>';
    } else {
      svg += '<text x="' + rightLabelX + '" y="' + (iconCY + 8) + '" text-anchor="middle" font-size="24" font-weight="700" fill="' + T.dark + '">' + app2.name.charAt(0) + '</text>';
    }
    svg += '<text x="' + rightLabelX + '" y="' + numY + '" text-anchor="middle" font-size="28" font-weight="700" fill="' + T.textBlack + '">' + fmtW(app2.onlyUsers) + '</text>';

    // 교집합 수치
    svg += '<text x="' + midLabelX + '" y="' + (vennCY + 8) + '" text-anchor="middle" font-size="28" font-weight="700" fill="#FFF">' + fmtW(crossCount) + '</text>';

    var boxH = Math.round((cBot - cTop - 20) / 2);
    var box1Y = cTop, box2Y = cTop + boxH + 20;

    function drawStatBox(bx, by, bw, bh, boxTitle, items, bi) {
      var s = '';
      s += '<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" rx="16" fill="#FFF" stroke="' + T.divider + '" stroke-width="1"/>';
      var titleH = 54;
      s += '<text x="' + (bx + bw / 2) + '" y="' + (by + titleH / 2 + 6) + '" text-anchor="middle" font-size="14" font-weight="700" fill="' + T.textDark + '">' + boxTitle + '</text>';
      s += '<line x1="' + (bx + 20) + '" y1="' + (by + titleH) + '" x2="' + (bx + bw - 20) + '" y2="' + (by + titleH) + '" stroke="' + T.divider + '" stroke-width="1"/>';
      var rowH = Math.round((bh - titleH) / items.length);
      items.forEach(function(item, i) {
        var ry = by + titleH + i * rowH;
        if (i > 0) s += '<line x1="' + (bx+20) + '" y1="' + ry + '" x2="' + (bx+bw-20) + '" y2="' + ry + '" stroke="' + T.divider + '" stroke-width="0.5"/>';
        var midRY = Math.round(ry + rowH / 2);
        var ir = 17, ix = bx + 28 + ir;
        var ibg = (item.pkg === 'com.netflix.mediaclient') ? '#000' : '#FFF';
        var iurl = self._appIcon(item.pkg);
        var cid = 'sb-' + uid + '-' + bi + '-' + i;
        s += '<defs><clipPath id="' + cid + '"><circle cx="' + ix + '" cy="' + midRY + '" r="' + (ir-1) + '"/></clipPath></defs>';
        s += '<circle cx="' + ix + '" cy="' + midRY + '" r="' + ir + '" fill="' + ibg + '" stroke="' + T.divider + '" stroke-width="1.2"/>';
        if (iurl) {
          s += '<image href="' + iurl + '" x="' + (ix-ir+1) + '" y="' + (midRY-ir+1) + '" width="' + ((ir-1)*2) + '" height="' + ((ir-1)*2) + '" clip-path="url(#' + cid + ')" preserveAspectRatio="xMidYMid slice"/>';
        } else {
          s += '<text x="' + ix + '" y="' + (midRY+5) + '" text-anchor="middle" font-size="13" fill="' + (ibg==='#000'?'#FFF':T.dark) + '">' + item.name.charAt(0) + '</text>';
        }
        s += '<text x="' + (ix+ir+12) + '" y="' + (midRY+5) + '" font-size="14" font-weight="600" fill="' + T.textDark + '">' + self._esc(item.name) + '</text>';
        s += '<text x="' + (bx+bw-24) + '" y="' + (midRY+7) + '" text-anchor="end" font-size="20" font-weight="700" fill="' + (i===0?T.accent:'#9B8CF8') + '">' + item.value + '</text>';
      });
      return s;
    }

    svg += drawStatBox(statsX, box1Y, statsW, boxH, '교차 사용자의 1인당 평균 사용시간', [
      { pkg: app1.pkg, name: app1.name, value: app1.crossTime + ' 시간' },
      { pkg: app2.pkg, name: app2.name, value: app2.crossTime + ' 시간' }
    ], 0);
    svg += drawStatBox(statsX, box2Y, statsW, boxH, '교차 사용자의 1인당 평균 사용일 수', [
      { pkg: app1.pkg, name: app1.name, value: app1.crossDays + ' 일' },
      { pkg: app2.pkg, name: app2.name, value: app2.crossDays + ' 일' }
    ], 1);

    return this._wrap(title, subtitle, source, svg);
  },


  _wrap(title, subtitle, source, innerSvg, filterInfo) {
    const W = T.W, H = T.H;
    const fi = filterInfo || this._filterInfo || '';
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${T.font}">`;
    svg += `<rect width="${W}" height="${H}" rx="20" fill="${T.bg}"/>`;
    svg += `<text x="${T.EDGE}" y="${T.TITLE_Y + 28}" font-size="35" font-weight="700" fill="${T.textBlack}" letter-spacing="-1.75">${this._esc(title)}</text>`;
    if (subtitle) svg += `<text x="${T.EDGE}" y="${T.SUBTITLE_Y + 12}" font-size="15" fill="${T.textMuted}">${this._esc(subtitle)}</text>`;
    svg += innerSvg;
    if (source) svg += `<text x="${W - T.EDGE}" y="${T.SOURCE_Y}" font-size="13" fill="${T.textMuted}" text-anchor="end">[출처: ${this._esc(source)}]</text>`;
    if (fi) svg += `<text x="${W/2}" y="${T.FILTER_Y}" font-size="11" fill="${T.textMuted}" text-anchor="middle">${this._esc(fi)}</text>`;
    svg += '</svg>';
    const div = document.createElement('div');
    div.className = 'chart-slide';
    div.innerHTML = svg;
    return div;
  },

  _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); },

  // 범례 이름 치환
  _legendName(name) {
    const custom = this._legendNames && this._legendNames[name];
    return custom || name;
  },

  // 텍스트 폭 추정 (한글=fontSize*0.95, 영문/숫자=fontSize*0.55, 기타=fontSize*0.6)
  _textW(str, fontSize) {
    let w = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      const ch = str[i];
      if (code >= 0xAC00 && code <= 0xD7AF) w += fontSize * 1.0;       // 한글
      else if (code >= 0x3000 && code <= 0x9FFF) w += fontSize * 1.0;  // CJK
      else if ('mwMW'.includes(ch)) w += fontSize * 0.78;              // 넓은 영문
      else if ('iltfjr!.:;|,\''.includes(ch)) w += fontSize * 0.32;   // 좁은 영문
      else if (ch >= 'A' && ch <= 'Z') w += fontSize * 0.68;          // 대문자
      else if (ch >= 'a' && ch <= 'z') w += fontSize * 0.52;          // 소문자
      else if (ch >= '0' && ch <= '9') w += fontSize * 0.56;          // 숫자
      else if (ch === ' ') w += fontSize * 0.28;                       // 공백
      else if (code >= 0x20 && code <= 0x7E) w += fontSize * 0.56;    // 기타 ASCII
      else w += fontSize * 0.65;
    }
    return Math.ceil(w);
  },

  // ── 라인 차트 ──
  line(title, subtitle, source, labels, series, colors, showValueLabels) {
    const W = T.W, padL = T.EDGE+60, padR = T.EDGE+40;
    // Legend icon mode: calculate extra cBot reduction when icons are in legend
    var _lineIconMode = SvgCharts._lineIconMode || 'legend';
    var _lnHasIcons = SvgCharts._showAppIcons !== false;
    var _lnIcM = _lnHasIcons ? this._iconMetrics(SvgCharts._iconSize) : null;
    var _lnLegendIconExtra = 0;
    if (_lnHasIcons && _lnIcM && _lineIconMode === 'legend' && SvgCharts._hasLegend) {
      _lnLegendIconExtra = _lnIcM.radius * 2 + 6;
    }
    const cW = W-padL-padR, cTop = T.chartTop(!!subtitle), cBot = T.chartBottom()-20 - _lnLegendIconExtra, cH = cBot-cTop;
    const allV = series.flatMap(s=>s.data);
    const mn = Math.min(...allV), mx = Math.max(...allV), rng = mx-mn||1;
    const yMin = Math.max(0, mn-rng*0.1), yMax = mx+rng*0.1, yR = yMax-yMin;
    const xStep = labels.length>1 ? cW/(labels.length-1) : cW;
    const toX = i => labels.length===1 ? padL+cW/2 : padL+i*xStep, toY = v => cTop+cH-((v-yMin)/yR)*cH;
    let svg = '';
    const useMan = yMax >= 1e4;
    for (let i=0;i<=4;i++) {
      const tick = yMin+(yR/4)*i, y = toY(tick);
      svg += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="${T.divider}"/>`;
      svg += `<text x="${padL-14}" y="${y+5}" text-anchor="end" fill="${T.textMuted}" font-size="13">${T.fmtTick(tick, SvgCharts._decimalPlaces, useMan)}</text>`;
    }
    const skip = labels.length>15 ? Math.ceil(labels.length/10) : 1;
    labels.forEach((l,i) => {
      if (i%skip!==0 && i!==labels.length-1) return;
      svg += `<text x="${toX(i)}" y="${cBot+28}" text-anchor="middle" fill="${T.textMuted}" font-size="12">${this._esc(l)}</text>`;
    });
    series.forEach((s,si) => {
      const c = colors[si] || T.SERIES[si%T.SERIES.length];
      const pts = s.data.map((v,i) => [toX(i),toY(v)]);
      const gradId = `ag${si}${Date.now()}`;
      svg += `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${c}" stop-opacity="0.12"/><stop offset="100%" stop-color="${c}" stop-opacity="0.01"/></linearGradient></defs>`;
      svg += `<path d="${this._smoothArea(pts, toY(yMin))}" fill="url(#${gradId})"/>`;
      svg += `<path d="${this._smooth(pts)}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      if (s.data.length<=30) pts.forEach(([x,y])=>svg+=`<circle cx="${x}" cy="${y}" r="3.5" fill="${T.bg}" stroke="${c}" stroke-width="2.5"/>`);
      // 값 라벨
      if (!SvgCharts._hideValueLabels) {
        const dp = SvgCharts._decimalPlaces;
        const every = s.data.length<=12?1:s.data.length<=20?2:Math.ceil(s.data.length/8);
        s.data.forEach((v,i) => {
          if (i%every!==0 && i!==s.data.length-1) return;
          svg += `<text x="${toX(i)}" y="${toY(v)-12}" text-anchor="middle" fill="${T.textMuted}" font-size="11" opacity="0.7">${T.fmt(v, dp)}</text>`;
        });
      }
    });
    if (SvgCharts._hasLegend) {
    var _legIcShape = SvgCharts._iconShape || 'circle';
    var _legIconW = (_lnHasIcons && _lnIcM && _lineIconMode === 'legend') ? (_lnIcM.radius * 2 + 6) : 0;
    var _chipH = (_lnHasIcons && _lnIcM && _lineIconMode === 'legend') ? Math.max(24, _lnIcM.radius * 2 + 8) : 22;
    var _chipPadX = 7;
    var _chipGap = 8;
    // 칩 너비 계산: 색상점(8) + 간격 + [아이콘 + 간격] + 텍스트 + 패딩
    const legFontSize = 12;
    const totalChipW = series.reduce((s,si2) => {
      var nameW = this._textW(this._legendName(si2.label), legFontSize);
      return s + _chipPadX*2 + 8 + 6 + _legIconW + nameW + _chipGap;
    }, 0) - _chipGap;
    const legRows = totalChipW > W - T.EDGE * 2 ? 2 : 1;
    const perRow = legRows > 1 ? Math.ceil(series.length / 2) : series.length;
    for (let row = 0; row < legRows; row++) {
      const rowItems = series.slice(row * perRow, (row + 1) * perRow);
      const rowW = rowItems.reduce((s,si2) => {
        var nameW = this._textW(this._legendName(si2.label), legFontSize);
        return s + _chipPadX*2 + 8 + 6 + _legIconW + nameW + _chipGap;
      }, 0) - _chipGap;
      let lx = Math.max(T.EDGE, W/2 - rowW/2);
      const ly = T.LEGEND_Y - 28 + row * (_chipH + 6);
      rowItems.forEach((s,i) => {
        const si = row * perRow + i;
        const c = colors[si] || T.SERIES[si%T.SERIES.length];
        const name = this._legendName(s.label);
        var nameW = this._textW(name, legFontSize);
        var chipW = Math.max(60, _chipPadX*2 + 8 + 6 + _legIconW + nameW + 4);
        // 칩 배경
        svg += `<rect x="${lx}" y="${ly - _chipH/2}" width="${chipW}" height="${_chipH}" rx="${_chipH/2}" fill="#F5F3FF" stroke="#E8E4FF" stroke-width="1"/>`;
        var cx = lx + _chipPadX;
        // 색상 점
        svg += `<circle cx="${cx + 4}" cy="${ly}" r="4" fill="${c}"/>`;
        cx += 8 + 6;
        // 아이콘
        if (_lnHasIcons && _lnIcM && _lineIconMode === 'legend') {
          var _legIcUrl = this._appIcon(s.label);
          if (_legIcUrl) {
            var _legIcClip = 'ln-chip-' + si + '-' + Date.now();
            svg += this._renderIcon(_legIcUrl, cx + _lnIcM.radius, ly, _lnIcM, _legIcShape, _legIcClip);
          } else if (s.label && s.label.length >= 2 && !/^\d/.test(s.label)) {
            svg += this._iconSpinner(cx + _lnIcM.radius, ly, _lnIcM.radius);
          }
          cx += _lnIcM.radius * 2 + 6;
        }
        // 이름
        svg += `<text x="${cx}" y="${ly + 4}" font-size="${legFontSize}" font-weight="600" fill="${T.textDark}">${this._esc(name)}</text>`;
        lx += chipW + _chipGap;
      });
    }
    }
    // Endpoint mode: show icons at line endpoints with collision avoidance
    if (_lnHasIcons && _lnIcM && _lineIconMode === 'endpoint' && labels.length > 0) {
      var _lnIcShape = SvgCharts._iconShape || 'circle';
      var _lnIcDiam = _lnIcM.radius * 2 + 4;
      // 각 시리즈의 마지막 Y좌표 수집
      var _lnEndPoints = series.map((s, si) => ({
        si: si,
        origY: toY(s.data[s.data.length - 1]),
        y: toY(s.data[s.data.length - 1]),
        label: s.label
      }));
      // Y좌표 기준 정렬 후 겹침 해소
      _lnEndPoints.sort((a, b) => a.y - b.y);
      for (var ei = 1; ei < _lnEndPoints.length; ei++) {
        var gap = _lnEndPoints[ei].y - _lnEndPoints[ei - 1].y;
        if (gap < _lnIcDiam) {
          _lnEndPoints[ei].y = _lnEndPoints[ei - 1].y + _lnIcDiam;
        }
      }
      // Clamp Y positions within chart area
      for (var ci = 0; ci < _lnEndPoints.length; ci++) {
        if (_lnEndPoints[ci].y - _lnIcM.radius < cTop) _lnEndPoints[ci].y = cTop + _lnIcM.radius;
        if (_lnEndPoints[ci].y + _lnIcM.radius > cBot) _lnEndPoints[ci].y = cBot - _lnIcM.radius;
      }
      // 원래 인덱스 순서로 복원
      _lnEndPoints.sort((a, b) => a.si - b.si);
      var lastX = toX(labels.length - 1);
      _lnEndPoints.forEach(function(ep) {
        var icUrl = SvgCharts._appIcon(ep.label);
        var icX = lastX + _lnIcM.radius + 8;
        var icY = ep.y;
        if (icUrl) {
          var icClip = 'ln-end-' + ep.si + '-' + Date.now();
          svg += SvgCharts._renderIcon(icUrl, icX, icY, _lnIcM, _lnIcShape, icClip);
        } else if (ep.label && ep.label.length >= 2 && !/^\d/.test(ep.label)) {
          svg += SvgCharts._iconSpinner(icX, icY, _lnIcM.radius);
        }
      });
    }
    return this._wrap(title, subtitle, source, svg);
  },

  // ── 세로 바 ──
  verticalBar(title, subtitle, source, labels, series, colors, showValueLabels) {
    const W = T.W, padL = T.EDGE+60, padR = T.EDGE+40;
    // 아이콘 영역 확보: 아이콘 ON이면 차트 하단을 아이콘 크기만큼 위로 올림
    const _hasIcons = SvgCharts._showAppIcons !== false;
    const _icM = _hasIcons ? this._iconMetrics(SvgCharts._iconSize) : null;
    const _iconAreaH = _hasIcons && _icM ? (_icM.radius * 2 + _icM.padding + 18) : 0;
    const cTop = T.chartTop(!!subtitle), cBot = T.chartBottom()-20 - _iconAreaH, cH = cBot-cTop, cW = W-padL-padR;
    const mx = Math.max(...series.flatMap(s=>s.data),1);
    const gW = cW/labels.length, gPad = Math.max(20,gW*0.2);
    const bArea = gW-gPad*2, bGap = Math.max(3,bArea*0.08);
    const bW = Math.max(6,(bArea-bGap*(series.length-1))/series.length);
    const toY = v => cTop+cH-(v/mx)*cH;
    let svg = '';
    const useMan = mx >= 1e4;
    for (let i=0;i<=4;i++) {
      const tick=(mx/4)*i, y=toY(tick);
      svg += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="${T.divider}"/>`;
      svg += `<text x="${padL-14}" y="${y+5}" text-anchor="end" fill="${T.textMuted}" font-size="12">${T.fmtTick(tick, SvgCharts._decimalPlaces, useMan)}</text>`;
    }
    labels.forEach((l,gi) => {
      const gx = padL+gi*gW;
      series.forEach((s,si) => {
        const v=s.data[gi]||0, bH=(v/mx)*cH, bx=gx+gPad+si*(bW+bGap), by=cTop+cH-bH;
        const c = colors[si]||T.SERIES[si%T.SERIES.length];
        svg += `<rect x="${bx}" y="${by}" width="${bW}" height="${bH}" fill="${c}" rx="${Math.min(4,bW/2)}"/>`;
        const dp = SvgCharts._decimalPlaces;
        if (bW>=28 && !SvgCharts._hideValueLabels) svg += `<text x="${bx+bW/2}" y="${by-8}" text-anchor="middle" fill="${T.textDark}" font-size="11" font-weight="600">${T.fmtTick(v, dp, useMan)}</text>`;
      });
      svg += `<text x="${gx+gW/2}" y="${cBot+24}" text-anchor="middle" fill="${T.textMuted}" font-size="12">${this._esc(l)}</text>`;
      // 앱 아이콘 (X축 라벨 아래)
      if (SvgCharts._showAppIcons !== false) {
        const icMetrics = this._iconMetrics(SvgCharts._iconSize);
        const icShape = SvgCharts._iconShape || 'circle';
        const icX = gx+gW/2, icY = cBot + 24 + icMetrics.padding + icMetrics.radius;
        const labelIcon = this._appIcon(l);
        if (labelIcon) {
          const icClip = `vb-ic-${gi}-${Date.now()}`;
          svg += this._renderIcon(labelIcon, icX, icY, icMetrics, icShape, icClip);
        } else if (l.length >= 2 && !/^\d/.test(l)) {
          svg += this._iconSpinner(icX, icY, icMetrics.radius);
        }
      }
    });
    if (series.length>1 && SvgCharts._hasLegend) {
      var _vbHasIcons = SvgCharts._showAppIcons !== false;
      var _vbIcM = _vbHasIcons ? this._iconMetrics(SvgCharts._iconSize) : null;
      var _vbIcShape = SvgCharts._iconShape || 'circle';
      var _vbIconW = _vbHasIcons && _vbIcM ? (_vbIcM.radius * 2 + 6) : 0;
      var _vbChipH = _vbHasIcons && _vbIcM ? Math.max(24, _vbIcM.radius * 2 + 8) : 22;
      var _vbPadX = 7;
      var _vbChipGap = 8;
      var _vbFs = 12;
      const totalChipW = series.reduce((s,sr) => s + _vbPadX*2 + 8 + 6 + _vbIconW + this._textW(this._legendName(sr.label), _vbFs) + _vbChipGap, 0) - _vbChipGap;
      const legRows = totalChipW > W - T.EDGE * 2 ? 2 : 1;
      const perRow = legRows > 1 ? Math.ceil(series.length / 2) : series.length;
      for (let row = 0; row < legRows; row++) {
        const rowItems = series.slice(row * perRow, (row + 1) * perRow);
        const rowW = rowItems.reduce((s,sr) => s + _vbPadX*2 + 8 + 6 + _vbIconW + this._textW(this._legendName(sr.label), _vbFs) + _vbChipGap, 0) - _vbChipGap;
        let lx = Math.max(T.EDGE, W/2 - rowW/2);
        const ly = T.LEGEND_Y - 28 + row * (_vbChipH + 6);
        rowItems.forEach((s,i) => {
          const si = row * perRow + i;
          const c = colors[si]||T.SERIES[si%T.SERIES.length];
          const name = this._legendName(s.label);
          var nameW = this._textW(name, _vbFs);
          var chipW = Math.max(60, _vbPadX*2 + 8 + 6 + _vbIconW + nameW + 4);
          svg += `<rect x="${lx}" y="${ly - _vbChipH/2}" width="${chipW}" height="${_vbChipH}" rx="${_vbChipH/2}" fill="#F5F3FF" stroke="#E8E4FF" stroke-width="1"/>`;
          var cx = lx + _vbPadX;
          svg += `<rect x="${cx}" y="${ly - 4}" width="8" height="8" rx="2" fill="${c}"/>`;
          cx += 8 + 6;
          if (_vbHasIcons && _vbIcM) {
            var icUrl = this._appIcon(s.label);
            if (icUrl) {
              svg += this._renderIcon(icUrl, cx + _vbIcM.radius, ly, _vbIcM, _vbIcShape, 'vb-leg-' + si + '-' + Date.now());
            } else if (s.label && s.label.length >= 2 && !/^\d/.test(s.label)) {
              svg += this._iconSpinner(cx + _vbIcM.radius, ly, _vbIcM.radius);
            }
            cx += _vbIconW;
          }
          svg += `<text x="${cx}" y="${ly + 4}" font-size="${_vbFs}" font-weight="600" fill="${T.textDark}">${this._esc(name)}</text>`;
          lx += chipW + _vbChipGap;
        });
      }
    }
    return this._wrap(title, subtitle, source, svg);
  },

  // ── 수평 바 ──
  horizontalBar(title, subtitle, source, rows, colors) {
    const W = T.W, LX = T.EDGE;
    const maxLbl = Math.max(...rows.map(r=>r.label.length),0);
    const LABEL_W = Math.max(70, Math.min(200, maxLbl*13));
    const BAR_L = LX+LABEL_W+10, BW = W-BAR_L-LX-10;
    const cTop = T.chartTop(!!subtitle), cEnd = T.chartBottom();
    const areaH = cEnd-cTop, rowH = Math.min(100, areaH/rows.length);
    const bH = Math.max(20, Math.min(52, rowH*0.6));
    const totalH = rows.length*rowH, offY = cTop+(areaH-totalH)/2;
    const mx = Math.max(...rows.map(r=>r.value),1);
    let svg = '';
    var _hbHasIcons = SvgCharts._showAppIcons !== false;
    var _hbIcM = _hbHasIcons ? this._iconMetrics(SvgCharts._iconSize) : null;
    var _hbIcShape = SvgCharts._iconShape || 'circle';
    rows.forEach((r,i) => {
      const y = offY+i*rowH, cy = y+(rowH-bH)/2;
      if (i>0) svg += `<line x1="${LX}" y1="${y}" x2="${W-LX}" y2="${y}" stroke="${T.divider}" stroke-width="0.5"/>`;
      const fillW = Math.max(0, Math.min(BW, (r.value/mx)*BW));
      const c = colors[i%colors.length] || T.dark;
      // App icon to the left of label
      var _hbTextX = LX;
      if (_hbHasIcons && _hbIcM) {
        var _hbIcUrl = this._appIcon(r.label);
        var _hbIcX = LX + _hbIcM.radius;
        var _hbIcY = cy + bH / 2;
        if (_hbIcUrl) {
          var _hbIcClip = 'hb-ic-' + i + '-' + Date.now();
          svg += this._renderIcon(_hbIcUrl, _hbIcX, _hbIcY, _hbIcM, _hbIcShape, _hbIcClip);
        } else if (r.label && r.label.length >= 2 && !/^\d/.test(r.label)) {
          svg += this._iconSpinner(_hbIcX, _hbIcY, _hbIcM.radius);
        }
        _hbTextX = LX + _hbIcM.radius * 2 + 6;
      }
      svg += `<text x="${_hbTextX}" y="${cy+bH/2+5}" font-size="13" font-weight="700" fill="${T.textBlack}">${this._esc(r.label)}</text>`;
      svg += `<rect x="${BAR_L}" y="${cy}" width="${BW}" height="${bH}" rx="8" fill="${T.track}"/>`;
      svg += `<rect x="${BAR_L}" y="${cy}" width="${fillW}" height="${bH}" rx="8" fill="${c}"/>`;
      if (!SvgCharts._hideValueLabels) {
        if (fillW>60) {
          svg += `<text x="${BAR_L+12}" y="${cy+bH/2+5}" font-size="14" font-weight="700" fill="${T.white}">${T.fmt(r.value, SvgCharts._decimalPlaces)}</text>`;
        } else {
          svg += `<text x="${BAR_L+fillW+8}" y="${cy+bH/2+5}" font-size="14" font-weight="700" fill="${T.textDark}">${T.fmt(r.value, SvgCharts._decimalPlaces)}</text>`;
        }
      }
    });
    return this._wrap(title, subtitle, source, svg);
  },

  // ── 도넛 ──
  donut(title, subtitle, source, segments) {
    const W = T.W, H = T.H, R = 170, IR = 105;
    const total = segments.reduce((s,seg)=>s+seg.value,0);
    if (!total) return this._wrap(title,subtitle,source,'');
    const CX = W/2-150, CY = H/2+15;
    let cum = 0, svg = '';
    segments.forEach((seg,i) => {
      const angle = (seg.value/total)*360, start = cum; cum += angle;
      const mid = start+angle/2;
      const s = this._polar(CX,CY,R,start), e = this._polar(CX,CY,R,cum);
      const is2 = this._polar(CX,CY,IR,cum), ie = this._polar(CX,CY,IR,start);
      const large = angle>180?1:0, c = T.DONUT[i%T.DONUT.length];
      svg += `<path d="M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y} L ${is2.x} ${is2.y} A ${IR} ${IR} 0 ${large} 0 ${ie.x} ${ie.y} Z" fill="${c}"/>`;
      if (angle>18 && !SvgCharts._hideValueLabels) { const dp=SvgCharts._decimalPlaces!=null?SvgCharts._decimalPlaces:1; const mp=this._polar(CX,CY,(R+IR)/2,mid); svg+=`<text x="${mp.x}" y="${mp.y+5}" text-anchor="middle" fill="#FFF" font-size="${angle>50?14:12}" font-weight="700">${(seg.value/total*100).toFixed(dp)}%</text>`; }
    });
    const legL = CX+R+60, legTop = CY-segments.length*22;
    var _dnHasIcons = SvgCharts._showAppIcons !== false;
    var _dnIcM = _dnHasIcons ? this._iconMetrics(SvgCharts._iconSize) : null;
    var _dnIcShape = SvgCharts._iconShape || 'circle';
    var _dnIconExtra = _dnHasIcons && _dnIcM ? (_dnIcM.radius * 2 + 4) : 0;
    segments.forEach((seg,i) => {
      const y = legTop+i*44;
      const dp=SvgCharts._decimalPlaces!=null?SvgCharts._decimalPlaces:1;
      // App icon before legend label
      var _dnLegTextX = legL + 28;
      if (_dnHasIcons && _dnIcM) {
        var _dnIcUrl = this._appIcon(seg.label);
        var _dnIcX = legL + 28 + _dnIcM.radius;
        var _dnIcY = y;
        if (_dnIcUrl) {
          var _dnIcClip = 'dn-ic-' + i + '-' + Date.now();
          svg += this._renderIcon(_dnIcUrl, _dnIcX, _dnIcY, _dnIcM, _dnIcShape, _dnIcClip);
        } else if (seg.label && seg.label.length >= 2 && !/^\d/.test(seg.label)) {
          svg += this._iconSpinner(_dnIcX, _dnIcY, _dnIcM.radius);
        }
        _dnLegTextX = legL + 28 + _dnIconExtra;
      }
      svg += `<circle cx="${legL+8}" cy="${y}" r="8" fill="${T.DONUT[i%T.DONUT.length]}"/>`;
      svg += `<text x="${_dnLegTextX}" y="${y+5}" font-size="18" fill="${T.textBlack}">${this._esc(seg.label)}</text>`;
      svg += `<text x="${legL+220 + _dnIconExtra}" y="${y+5}" font-size="22" font-weight="700" fill="${T.DONUT[i%T.DONUT.length]}">${(seg.value/total*100).toFixed(dp)}%</text>`;
    });
    return this._wrap(title, subtitle, source, svg);
  },

  // ── 콤보 (막대+꺾은선) ──
  combo(title, subtitle, source, labels, barData, barLabel, lineData, lineLabel, barColor, lineColor) {
    barColor=barColor||'#C4B5FD'; lineColor=lineColor||'#6C5CE7';
    const W=T.W, padL=T.EDGE+65, padR=T.EDGE+65;
    // 아이콘 범례 칩 높이만큼 차트 영역 축소
    var _cmLegExtra = (SvgCharts._showAppIcons !== false) ? 40 : 0;
    const cTop=T.chartTop(!!subtitle), cBot=T.chartBottom() - _cmLegExtra, cH=cBot-cTop, cW=W-padL-padR;
    const bMx=Math.max(...barData,1);
    const lMn=Math.min(...lineData), lMx=Math.max(...lineData), lRng=lMx-lMn||1;
    const lYMin=Math.max(0,lMn-lRng*0.2), lYMax=lMx+lRng*0.2, lYR=lYMax-lYMin;
    const xStep=labels.length>1?cW/labels.length:cW, bW=Math.max(6,xStep*0.5);
    const toBarY=v=>cTop+cH-(v/bMx)*cH, toLineY=v=>cTop+cH-((v-lYMin)/lYR)*cH, toX=i=>padL+i*xStep+xStep/2;
    let svg='';
    const useManBar=bMx>=1e4;
    for(let i=0;i<=4;i++){const tick=(bMx/4)*i,y=toBarY(tick);svg+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="${T.divider}"/>`;svg+=`<text x="${padL-10}" y="${y+4}" text-anchor="end" fill="${barColor}" font-size="11">${T.fmtTick(tick,null,useManBar)}</text>`;}
    for(let i=0;i<=4;i++){const tick=lYMin+(lYR/4)*i,y=toLineY(tick);svg+=`<text x="${W-padR+10}" y="${y+4}" text-anchor="start" fill="${lineColor}" font-size="11">${tick.toFixed(1)}</text>`;}
    const xSkip=labels.length>15?Math.ceil(labels.length/8):1;
    labels.forEach((l,i)=>{if(i%xSkip!==0&&i!==labels.length-1)return;svg+=`<text x="${toX(i)}" y="${cBot+22}" text-anchor="middle" fill="${T.textMuted}" font-size="10">${this._esc(l)}</text>`;});
    barData.forEach((v,i)=>{const bh=(v/bMx)*cH,bx=toX(i)-bW/2,by=cTop+cH-bh;svg+=`<rect x="${bx}" y="${by}" width="${bW}" height="${bh}" fill="${barColor}" rx="${Math.min(4,bW/2)}" opacity="0.7"/>`;});
    svg+=`<polyline points="${lineData.map((v,i)=>`${toX(i)},${toLineY(v)}`).join(' ')}" fill="none" stroke="${lineColor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    lineData.forEach((v,i)=>svg+=`<circle cx="${toX(i)}" cy="${toLineY(v)}" r="3.5" fill="${T.bg}" stroke="${lineColor}" stroke-width="2.5"/>`);
    var _cmHasIcons = SvgCharts._showAppIcons !== false;
    var _cmIcM = _cmHasIcons ? this._iconMetrics(SvgCharts._iconSize) : null;
    var _cmIcShape = SvgCharts._iconShape || 'circle';
    var _cmIconW = _cmHasIcons && _cmIcM ? (_cmIcM.radius * 2 + 6) : 0;
    var _cmChipH = _cmHasIcons && _cmIcM ? Math.max(24, _cmIcM.radius * 2 + 8) : 22;
    var _cmPadX = 7;
    var _cmFs = 12;
    // 칩 1: 막대
    var _cmBarNameW = this._textW(barLabel, _cmFs);
    var _cmBarChipW = _cmPadX*2 + 8 + 6 + _cmIconW + _cmBarNameW;
    // 칩 2: 꺾은선
    var _cmLineNameW = this._textW(lineLabel, _cmFs);
    var _cmLineChipW = _cmPadX*2 + 8 + 6 + _cmIconW + _cmLineNameW;
    var _cmTotalW = _cmBarChipW + 10 + _cmLineChipW;
    var _cmStartX = W/2 - _cmTotalW/2;
    var _cmLy = T.LEGEND_Y - 28;
    // 막대 칩
    svg += `<rect x="${_cmStartX}" y="${_cmLy - _cmChipH/2}" width="${_cmBarChipW}" height="${_cmChipH}" rx="${_cmChipH/2}" fill="#F5F3FF" stroke="#E8E4FF" stroke-width="1"/>`;
    var _cmCx = _cmStartX + _cmPadX;
    svg += `<rect x="${_cmCx}" y="${_cmLy - 4}" width="8" height="8" rx="2" fill="${barColor}" opacity="0.7"/>`;
    _cmCx += 8 + 6;
    if (_cmHasIcons && _cmIcM) {
      var _cmIc1 = this._appIcon(barLabel);
      if (_cmIc1) { svg += this._renderIcon(_cmIc1, _cmCx + _cmIcM.radius, _cmLy, _cmIcM, _cmIcShape, 'cm-bl-' + Date.now()); }
      else if (barLabel.length >= 2) { svg += this._iconSpinner(_cmCx + _cmIcM.radius, _cmLy, _cmIcM.radius); }
      _cmCx += _cmIconW;
    }
    svg += `<text x="${_cmCx}" y="${_cmLy + 4}" font-size="${_cmFs}" font-weight="600" fill="${T.textDark}">${this._esc(barLabel)}</text>`;
    // 꺾은선 칩
    var _cmLx2 = _cmStartX + _cmBarChipW + 10;
    svg += `<rect x="${_cmLx2}" y="${_cmLy - _cmChipH/2}" width="${_cmLineChipW}" height="${_cmChipH}" rx="${_cmChipH/2}" fill="#F5F3FF" stroke="#E8E4FF" stroke-width="1"/>`;
    var _cmCx2 = _cmLx2 + _cmPadX;
    svg += `<line x1="${_cmCx2}" y1="${_cmLy}" x2="${_cmCx2 + 8}" y2="${_cmLy}" stroke="${lineColor}" stroke-width="2.5" stroke-linecap="round"/>`;
    _cmCx2 += 8 + 6;
    if (_cmHasIcons && _cmIcM) {
      var _cmIc2 = this._appIcon(lineLabel);
      if (_cmIc2) { svg += this._renderIcon(_cmIc2, _cmCx2 + _cmIcM.radius, _cmLy, _cmIcM, _cmIcShape, 'cm-ll-' + Date.now()); }
      else if (lineLabel.length >= 2) { svg += this._iconSpinner(_cmCx2 + _cmIcM.radius, _cmLy, _cmIcM.radius); }
      _cmCx2 += _cmIconW;
    }
    svg += `<text x="${_cmCx2}" y="${_cmLy + 4}" font-size="${_cmFs}" font-weight="600" fill="${T.textDark}">${this._esc(lineLabel)}</text>`;
    return this._wrap(title, subtitle, source, svg);
  },

  // ── 스플릿 바 (하나의 바 안에서 세그먼트가 이어서 채워짐) ──
  splitBar(title, subtitle, source, labels, series, colors) {
    const W = T.W, LX = T.EDGE;
    const cTop = T.chartTop(!!subtitle) + 10;
    const cBot = T.chartBottom(); // 범례 위 여유
    const cH = cBot - cTop;
    const rowCount = labels.length;
    const rowH = cH / rowCount; // 공간 꽉 채움
    const barH = Math.max(20, rowH * 0.65);
    const totalH = rowCount * rowH;
    const offY = cTop;
    const iconSize = 28;
    const maxLabelLen = Math.max(...labels.map(l => l.length), 0);
    const labelW = Math.max(80, Math.min(180, maxLabelLen * 12));
    const barL = LX + labelW + 12;
    const barW = W - barL - LX - 10;
    // 보라 톤 팔레트
    const segColors = ['#4C1D95','#6D28D9','#8B5CF6','#A78BFA','#C4B5FD','#DDD6FE','#EDE9FE','#F5F3FF'];

    let svg = '';

    // X축 눈금
    for (let v = 0; v <= 100; v += 20) {
      const x = barL + (v / 100) * barW;
      svg += `<line x1="${x}" y1="${offY}" x2="${x}" y2="${offY + totalH}" stroke="${T.divider}" stroke-width="0.5"/>`;
      svg += `<text x="${x}" y="${offY + totalH + 18}" text-anchor="middle" fill="${T.textMuted}" font-size="11">${v}</text>`;
    }

    labels.forEach((label, ri) => {
      const y = offY + ri * rowH;
      const barY = y + (rowH - barH) / 2;

      // App icon + 앱명 텍스트
      var _sbHasIcons = SvgCharts._showAppIcons !== false;
      var _sbIcM = _sbHasIcons ? this._iconMetrics(SvgCharts._iconSize) : null;
      var _sbIcShape = SvgCharts._iconShape || 'circle';
      const textY = y + rowH / 2 + 5;
      var _sbTextX = LX;
      if (_sbHasIcons && _sbIcM) {
        var _sbIcUrl = this._appIcon(label);
        var _sbIcX = LX + _sbIcM.radius;
        var _sbIcY = y + rowH / 2;
        if (_sbIcUrl) {
          var _sbIcClip = 'sb-ic-' + ri + '-' + Date.now();
          svg += this._renderIcon(_sbIcUrl, _sbIcX, _sbIcY, _sbIcM, _sbIcShape, _sbIcClip);
        } else if (label && label.length >= 2 && !/^\d/.test(label)) {
          svg += this._iconSpinner(_sbIcX, _sbIcY, _sbIcM.radius);
        }
        _sbTextX = LX + _sbIcM.radius * 2 + 6;
      }
      svg += `<text x="${_sbTextX}" y="${textY}" font-size="13" font-weight="600" fill="${T.textBlack}">${this._esc(label)}</text>`;

      // 스플릿 바: 클리핑으로 전체 둥근 모서리
      const clipId = `sb-${ri}-${Date.now()}`;
      svg += `<defs><clipPath id="${clipId}"><rect x="${barL}" y="${barY}" width="${barW}" height="${barH}" rx="${barH/2}"/></clipPath></defs>`;
      svg += `<rect x="${barL}" y="${barY}" width="${barW}" height="${barH}" rx="${barH/2}" fill="${T.track}"/>`;

      let cumX = 0;
      // 각 바별 세그먼트 합계 → 비율로 변환
      const rowTotal = series.reduce((s, sr) => s + (sr.data[ri] || 0), 0) || 1;
      series.forEach((sr, si) => {
        const val = sr.data[ri] || 0;
        const ratio = val / rowTotal;
        const segW = ratio * barW;
        const c = segColors[si % segColors.length];
        svg += `<rect x="${barL + cumX}" y="${barY}" width="${segW + 0.5}" height="${barH}" fill="${c}" clip-path="url(#${clipId})"/>`;
        cumX += segW;
      });
    });

    // 범례 (중앙 정렬)
    const totalLegW = series.reduce((s, sr) => s + this._textW(sr.label, 12) + 28, 0);
    let lx = (W - totalLegW) / 2;
    series.forEach((sr, si) => {
      const c = segColors[si % segColors.length];
      svg += `<circle cx="${lx + 5}" cy="${T.LEGEND_Y}" r="5" fill="${c}"/>`;
      svg += `<text x="${lx + 16}" y="${T.LEGEND_Y + 4}" font-size="12" fill="${T.textDark}">${this._esc(sr.label)}</text>`;
      lx += this._textW(sr.label, 12) + 28;
    });

    return this._wrap(title, subtitle, source, svg);
  },

  // ── 유입/이탈 플로우 카드 (왼쪽 랭킹 + 오른쪽 KPI) ──
  flowCard(title, subtitle, source, appName, totalValue, totalLabel, items, colors, appPkg, direction, headerLabel, noteText) {
      const W = T.W, H = T.H;
      const cTop = T.chartTop(!!subtitle);
      const cBot = T.SOURCE_Y - 20;
      const cH = cBot - cTop;
      const centerY = cTop + cH / 2;
      const isOut = direction === 'out';

      const listW = W * 0.52, kpiW = W * 0.30;
      const listX = isOut ? W - T.EDGE - listW : T.EDGE;
      const kpiX = isOut ? T.EDGE : W - T.EDGE - kpiW;

      const rowH = Math.min(52, (cH - 70) / Math.max(items.length, 1));
      const listH = 50 + items.length * rowH + 10;
      const listTop = centerY - listH / 2;

      let svg = '';

      // 랭킹 리스트
      svg += `<rect x="${listX}" y="${listTop}" width="${listW}" height="${listH}" rx="16" fill="#FFFFFF"/>`;
      const hdrColor = T.accent;
      svg += `<rect x="${listX}" y="${listTop}" width="${listW}" height="44" rx="16" fill="${hdrColor}"/>`;
      svg += `<rect x="${listX}" y="${listTop + 28}" width="${listW}" height="16" fill="${hdrColor}"/>`;
      svg += `<text x="${listX + 20}" y="${listTop + 28}" font-size="15" font-weight="700" fill="#FFF">${headerLabel || '경쟁앱'}</text>`;

      const barAreaW = listW * 0.20;
      items.forEach((item, i) => {
        const y = listTop + 50 + i * rowH;
        const pctVal = Number(item.pct) || 0;
        const barC = colors[i % colors.length] || T.SERIES[i % T.SERIES.length];

        if (i > 0) svg += `<line x1="${listX + 16}" y1="${y}" x2="${listX + listW - 16}" y2="${y}" stroke="${T.divider}" stroke-width="0.5"/>`;

        const midY = y + rowH / 2;
        svg += `<text x="${listX + 24}" y="${midY + 5}" font-size="14" font-weight="600" fill="${T.textMuted}">${item.rank}위</text>`;

        // 앱 아이콘 (이름으로 검색)
        const itemIconUrl = this._appIcon(item.name);
        const fcMetrics = this._iconMetrics(SvgCharts._iconSize);
        const fcShape = SvgCharts._iconShape || 'circle';
        const icoR = fcMetrics.radius;
        const icoX = listX + 68 + icoR;
        if (itemIconUrl) {
          const icClip = `fc-item-${i}-${Date.now()}`;
          svg += this._renderIcon(itemIconUrl, icoX, midY, fcMetrics, fcShape, icClip);
          svg += `<text x="${icoX + icoR + 8}" y="${midY + 5}" font-size="14" font-weight="600" fill="${T.textBlack}">${this._esc(item.name)}</text>`;
        } else {
          svg += this._iconSpinner(icoX, midY, icoR);
          svg += `<text x="${icoX + icoR + 8}" y="${midY + 5}" font-size="14" font-weight="600" fill="${T.textBlack}">${this._esc(item.name)}</text>`;
        }

        const barX = listX + listW * 0.48;
        const barClip = `fc-bar-${i}-${Date.now()}`;
        svg += `<defs><clipPath id="${barClip}"><rect x="${barX}" y="${midY - 10}" width="${barAreaW}" height="20" rx="10"/></clipPath></defs>`;
        svg += `<rect x="${barX}" y="${midY - 10}" width="${barAreaW}" height="20" rx="10" fill="${T.track}"/>`;
        const fillW = (pctVal / 100) * barAreaW;
        if (fillW > 0) {
          svg += `<rect x="${barX}" y="${midY - 10}" width="${fillW}" height="20" fill="${barC}" clip-path="url(#${barClip})"/>`;
        }
        svg += `<text x="${barX + barAreaW + 8}" y="${midY + 5}" font-size="12" font-weight="700" fill="${T.accent}">${pctVal}%</text>`;
        svg += `<text x="${listX + listW - 20}" y="${midY + 5}" font-size="13" font-weight="600" fill="${T.textDark}" text-anchor="end">${T.fmt(item.value)}명</text>`;
      });

      // 참고 문구
      svg += `<text x="${listX + 16}" y="${listTop + listH + 14}" font-size="11" fill="${T.textMuted}">${noteText || ''}</text>`;

      // KPI 카드
      const cardH = 260;
      const cardTop = centerY - cardH / 2;
      svg += `<rect x="${kpiX}" y="${cardTop}" width="${kpiW}" height="${cardH}" rx="16" fill="#FFFFFF" stroke="${T.divider}" stroke-width="1"/>`;

      const cardCY = cardTop + cardH / 2;
      const iconR = 28;
      const iconCx = kpiX + kpiW / 2;
      const iconCy = cardCY - 50;
      const iconUrl = appPkg ? SvgCharts._appIcon(appPkg) : (SvgCharts._appIcon(appName) || '');
      const iconBgMap = { 'com.netflix.mediaclient': '#000000' };
      const iconBg = iconBgMap[appPkg] || '#FFFFFF';
      const iconStroke = iconBg === '#FFFFFF' ? T.divider : iconBg;
      if (iconUrl) {
        svg += `<circle cx="${iconCx}" cy="${iconCy}" r="${iconR}" fill="${iconBg}" stroke="${iconStroke}" stroke-width="1.5"/>`;
        const clipId = `fc-clip-${Date.now()}`;
        svg += `<defs><clipPath id="${clipId}"><circle cx="${iconCx}" cy="${iconCy}" r="${iconR - 2}"/></clipPath></defs>`;
        svg += `<image href="${iconUrl}" x="${iconCx - iconR + 2}" y="${iconCy - iconR + 2}" width="${(iconR-2)*2}" height="${(iconR-2)*2}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`;
      } else {
        svg += this._iconSpinner(iconCx, iconCy, iconR);
      }

      svg += `<text x="${kpiX + kpiW/2}" y="${cardCY + 6}" text-anchor="middle" font-size="16" font-weight="700" fill="${T.textBlack}">${this._esc(appName)}</text>`;
      svg += `<text x="${kpiX + kpiW/2}" y="${cardCY + 30}" text-anchor="middle" font-size="13" fill="${T.textMuted}">${this._esc(totalLabel)}</text>`;
      const numColor = T.accent;
      svg += `<text x="${kpiX + kpiW/2}" y="${cardCY + 64}" text-anchor="middle" font-size="32" font-weight="800" fill="${numColor}">${totalValue.toLocaleString()}명</text>`;

      // 화살표
      if (isOut) {
        const ax1 = kpiX + kpiW + 8, ax2 = listX - 8;
        svg += `<line x1="${ax1}" y1="${centerY}" x2="${ax2 - 6}" y2="${centerY}" stroke="${hdrColor}" stroke-width="2" stroke-dasharray="4,3"/>`;
        svg += `<polygon points="${ax2},${centerY} ${ax2 - 8},${centerY - 5} ${ax2 - 8},${centerY + 5}" fill="${hdrColor}"/>`;
      } else {
        const ax1 = listX + listW + 8, ax2 = kpiX - 8;
        svg += `<line x1="${ax1}" y1="${centerY}" x2="${ax2 - 6}" y2="${centerY}" stroke="${hdrColor}" stroke-width="2" stroke-dasharray="4,3"/>`;
        svg += `<polygon points="${ax2},${centerY} ${ax2 - 8},${centerY - 5} ${ax2 - 8},${centerY + 5}" fill="${hdrColor}"/>`;
      }

      return this._wrap(title, subtitle, source, svg);
    }
,

  // ── 누적 막대 (Stacked Bar) ──
  stackedBar(title, subtitle, source, labels, series, colors) {
    const W = T.W, padL = T.EDGE + 50, padR = T.EDGE + 20;
    const cTop = T.chartTop(!!subtitle);
    // Icon area: reserve space below X-axis labels when icons are enabled
    var _sbkHasIcons = SvgCharts._showAppIcons !== false;
    var _sbkIcM = _sbkHasIcons ? this._iconMetrics(SvgCharts._iconSize) : null;
    var _sbkIconAreaH = _sbkHasIcons && _sbkIcM ? (_sbkIcM.radius * 2 + _sbkIcM.padding + 18) : 0;
    var _sbkIcShape = SvgCharts._iconShape || 'circle';
    const cBot = T.chartBottom() - 30 - _sbkIconAreaH, cH = cBot - cTop;
    const cW = W - padL - padR;
    const gW = cW / labels.length, gPad = Math.max(12, gW * 0.15);
    const bW = gW - gPad * 2;

    // 각 그룹의 합계 → 100% 기준 or 실제값 기준
    const totals = labels.map((_, gi) => series.reduce((s, sr) => s + (sr.data[gi] || 0), 0));
    const maxTotal = Math.max(...totals, 1);
    // 모든 합이 95~105 사이면 퍼센트 모드
    const isPct = totals.every(t => t > 85 && t < 115);

    let svg = '';
    // Y축
    for (let i = 0; i <= 5; i++) {
      const v = isPct ? i * 20 : (maxTotal / 5) * i;
      const y = cTop + cH - (v / (isPct ? 100 : maxTotal)) * cH;
      svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${T.divider}"/>`;
      svg += `<text x="${padL - 10}" y="${y + 4}" text-anchor="end" fill="${T.textMuted}" font-size="12">${isPct ? v + '%' : T.fmtTick(v, null, maxTotal >= 1e4)}</text>`;
    }

    // 막대
    labels.forEach((l, gi) => {
      const gx = padL + gi * gW;
      const total = totals[gi] || 1;
      let cumY = 0;
      series.forEach((sr, si) => {
        const v = sr.data[gi] || 0;
        const ratio = isPct ? v / 100 : v / maxTotal;
        const segH = ratio * cH;
        const y = cTop + cH - cumY - segH;
        const c = colors[si % colors.length] || T.SERIES[si % T.SERIES.length];
        svg += `<rect x="${gx + gPad}" y="${y}" width="${bW}" height="${segH}" fill="${c}" rx="0"/>`;
        // 값 라벨 (충분히 크면)
        if (segH > 18 && !SvgCharts._hideValueLabels) {
          const dp = SvgCharts._decimalPlaces;
          svg += `<text x="${gx + gPad + bW/2}" y="${y + segH/2 + 4}" text-anchor="middle" fill="#FFF" font-size="${Math.min(13, segH * 0.5)}" font-weight="600">${isPct ? v.toFixed(dp!=null?dp:1) + '%' : T.fmt(v, dp)}</text>`;
        }
        cumY += segH;
      });
      // 상단 둥근 모서리 (맨 위 세그먼트)
      // X축 라벨
      svg += `<text x="${gx + gW/2}" y="${cBot + 20}" text-anchor="middle" fill="${T.textMuted}" font-size="11">${this._esc(l)}</text>`;
      // App icon below X-axis label
      if (_sbkHasIcons && _sbkIcM) {
        var _sbkIcUrl = this._appIcon(l);
        var _sbkIcX = gx + gW / 2;
        var _sbkIcY = cBot + 20 + _sbkIcM.padding + _sbkIcM.radius;
        if (_sbkIcUrl) {
          var _sbkIcClip = 'stk-ic-' + gi + '-' + Date.now();
          svg += this._renderIcon(_sbkIcUrl, _sbkIcX, _sbkIcY, _sbkIcM, _sbkIcShape, _sbkIcClip);
        } else if (l.length >= 2 && !/^\d/.test(l)) {
          svg += this._iconSpinner(_sbkIcX, _sbkIcY, _sbkIcM.radius);
        }
      }
    });

    // 범례
    let lx = W / 2 - series.length * 50;
    series.forEach((sr, si) => {
      const c = colors[si % colors.length] || T.SERIES[si % T.SERIES.length];
      svg += `<circle cx="${lx + 6}" cy="${T.LEGEND_Y}" r="5" fill="${c}"/>`;
      svg += `<text x="${lx + 16}" y="${T.LEGEND_Y + 4}" font-size="12" fill="${T.textDark}">${this._esc(sr.label)}</text>`;
      lx += this._textW(sr.label, 12) + 30;
    });

    return this._wrap(title, subtitle, source, svg);
  },

  // ── 버블 비교 (멀티 그룹, 드래그 가능) ──
  bubble(title, subtitle, source, groups, colors) {
    const W = T.W, H = T.H;
    const div = document.createElement('div');
    div.className = 'chart-slide';
    div.style.cssText = `width:100%;aspect-ratio:1200/750;background:${T.bg};border-radius:20px;position:relative;overflow:hidden;font-family:${T.font}`;

    let headerHtml = `<div style="position:absolute;left:${T.EDGE}px;top:${T.TITLE_Y}px;font-size:35px;font-weight:700;color:${T.textBlack};letter-spacing:-1.75px">${this._esc(title)}</div>`;
    if (subtitle) headerHtml += `<div style="position:absolute;left:${T.EDGE}px;top:${T.SUBTITLE_Y}px;font-size:15px;color:${T.textMuted}">${this._esc(subtitle)}</div>`;
    if (source) headerHtml += `<div style="position:absolute;right:${T.EDGE}px;top:${T.SOURCE_Y}px;font-size:13px;color:${T.textMuted}">[출처: ${this._esc(source)}]</div>`;

    const areaTop = T.chartTop(!!subtitle);
    const areaH = T.SOURCE_Y - 30 - areaTop;
    const totalW = W - T.EDGE * 2;
    const groupCount = groups.length;
    const gap = groupCount > 1 ? 16 : 0;
    const cardW = (totalW - gap * (groupCount - 1)) / groupCount;

    let cardsHtml = '';
    groups.forEach((group, gi) => {
      const left = T.EDGE + gi * (cardW + gap);
      const items = group.items;
      const maxVal = Math.max(...items.map(it => it.value), 1);
      const avgR = Math.sqrt((0.55 * cardW * areaH) / (Math.max(items.length, 1) * Math.PI));
      const maxR = Math.min(avgR * 1.6, Math.min(cardW, areaH) * 0.4);
      const minR = Math.max(avgR * 0.4, 20);
      const positions = this._layoutBubbles(items, cardW - 20, areaH - 40, minR, maxR);

      let cardBg = groupCount > 1 ? 'background:rgba(255,255,255,0.6);border-radius:16px;' : '';
      cardsHtml += `<div class="bubble-area" style="position:absolute;left:${left}px;top:${areaTop}px;width:${cardW}px;height:${areaH}px;${cardBg}">`;

      // 그룹 타이틀
      if (group.title) {
        cardsHtml += `<div style="position:absolute;top:8px;left:0;width:100%;text-align:center;font-size:16px;font-weight:700;color:${T.textBlack}">${this._esc(group.title)}</div>`;
      }

      const offsetY = group.title ? 20 : 0;
      items.forEach((item, i) => {
        const pos = positions[i] || { x: cardW/2, y: areaH/2, r: 30 };
        const c = colors[i % colors.length] || T.SERIES[i % T.SERIES.length];
        const fs = Math.max(10, pos.r / 4);
        const subFs = Math.max(8, pos.r / 5.5);
        cardsHtml += `<div class="bubble-item" data-idx="${i}" style="
          position:absolute;left:${pos.x - pos.r + 10}px;top:${pos.y - pos.r + offsetY + 20}px;
          width:${pos.r*2}px;height:${pos.r*2}px;border-radius:50%;
          background:${c};display:flex;flex-direction:column;align-items:center;justify-content:center;
          color:#FFF;text-align:center;padding:6px;box-sizing:border-box;
          cursor:grab;user-select:none;
          box-shadow:0 2px 8px rgba(0,0,0,0.06);transition:box-shadow 0.2s,transform 0.2s;
        ">
          <div style="font-size:${fs}px;font-weight:700;line-height:1.2;pointer-events:none;word-break:keep-all">${this._esc(item.label)}</div>
          <div style="font-size:${subFs}px;font-weight:400;margin-top:2px;opacity:0.85;pointer-events:none">${this._esc(item.subLabel)}</div>
        </div>`;
      });
      cardsHtml += '</div>';
    });

    // 힌트
    const hintHtml = `<div class="bubble-hint" style="
      position:absolute;top:${areaTop + 8}px;left:50%;transform:translateX(-50%);
      background:rgba(108,92,231,0.9);color:#fff;font-size:12px;font-weight:500;
      padding:6px 14px;border-radius:20px;white-space:nowrap;z-index:20;
      box-shadow:0 4px 12px rgba(108,92,231,0.25);pointer-events:auto;cursor:pointer;
    ">✦ 버블을 드래그해서 위치를 바꿀 수 있어요 ✕</div>`;

    div.innerHTML = headerHtml + cardsHtml + hintHtml;

    // 드래그 로직 (각 bubble-area 독립)
    requestAnimationFrame(() => {
      const hint = div.querySelector('.bubble-hint');
      if (hint) hint.addEventListener('click', () => hint.remove());

      div.querySelectorAll('.bubble-area').forEach(area => {
        const aW = area.offsetWidth, aH = area.offsetHeight;
        let dragEl = null, startX = 0, startY = 0, origL = 0, origT = 0;

        area.addEventListener('mousedown', e => {
          const bubble = e.target.closest('.bubble-item');
          if (!bubble) return;
          e.preventDefault();
          dragEl = bubble;
          startX = e.clientX; startY = e.clientY;
          origL = parseInt(bubble.style.left); origT = parseInt(bubble.style.top);
          bubble.style.cursor = 'grabbing';
          bubble.style.zIndex = '10';
          bubble.style.boxShadow = '0 12px 32px rgba(108,92,231,0.25)';
          bubble.style.transform = 'scale(1.04)';
          if (hint) hint.remove();
        });

        const onMove = e => {
          if (!dragEl) return;
          const dx = e.clientX - startX, dy = e.clientY - startY;
          const r = parseInt(dragEl.style.width) / 2;
          dragEl.style.left = Math.max(0, Math.min(aW - r*2, origL + dx)) + 'px';
          dragEl.style.top = Math.max(0, Math.min(aH - r*2, origT + dy)) + 'px';
        };
        const onUp = () => {
          if (!dragEl) return;
          dragEl.style.cursor = 'grab'; dragEl.style.zIndex = '1';
          dragEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
          dragEl.style.transform = 'scale(1)';
          dragEl = null;
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });
    });

    return div;
  },

  // 버블 레이아웃 알고리즘 (겹침 방지 + 영역 내 보장)
  _layoutBubbles(items, areaW, areaH, minR, maxR) {
    if (items.length === 0) return [];
    const maxVal = Math.max(...items.map(it => it.value), 1);
    const GAP = 6;

    // 스케일을 줄여가며 모두 배치될 때까지 시도
    for (let scale = 1.0; scale > 0.15; scale -= 0.03) {
      const sMaxR = maxR * scale;
      const sMinR = Math.min(minR * scale, sMaxR * 0.5);

      const sorted = items.map((it, i) => {
        const ratio = Math.sqrt(it.value / maxVal);
        return { i, r: Math.max(sMinR, sMinR + ratio * (sMaxR - sMinR)) };
      }).sort((a, b) => b.r - a.r);

      const placed = [];
      let allFit = true;

      for (let si = 0; si < sorted.length; si++) {
        const b = sorted[si];
        if (si === 0) {
          placed.push({ x: areaW / 2, y: areaH / 2, r: b.r, i: b.i });
          continue;
        }

        let bestX = -1, bestY = -1, bestScore = Infinity;

        for (const p of placed) {
          for (let angle = 0; angle < 360; angle += 4) {
            const rad = angle * Math.PI / 180;
            const cx = p.x + Math.cos(rad) * (p.r + b.r + GAP);
            const cy = p.y + Math.sin(rad) * (p.r + b.r + GAP);

            // 영역 내 체크
            if (cx - b.r < 2 || cx + b.r > areaW - 2 || cy - b.r < 2 || cy + b.r > areaH - 2) continue;

            // 겹침 체크
            const overlaps = placed.some(q => {
              const dx = cx - q.x, dy = cy - q.y;
              return Math.sqrt(dx * dx + dy * dy) < q.r + b.r + GAP - 1;
            });
            if (overlaps) continue;

            // 중심에 가까울수록 좋음
            const gcx = placed.reduce((s, q) => s + q.x, 0) / placed.length;
            const gcy = placed.reduce((s, q) => s + q.y, 0) / placed.length;
            const score = Math.sqrt((cx - gcx) ** 2 + (cy - gcy) ** 2);

            if (score < bestScore) { bestScore = score; bestX = cx; bestY = cy; }
          }
        }

        if (bestX < 0) { allFit = false; break; }
        placed.push({ x: bestX, y: bestY, r: b.r, i: b.i });
      }

      if (!allFit) continue;

      // 전체를 중앙 정렬
      const bMinX = Math.min(...placed.map(p => p.x - p.r));
      const bMaxX = Math.max(...placed.map(p => p.x + p.r));
      const bMinY = Math.min(...placed.map(p => p.y - p.r));
      const bMaxY = Math.max(...placed.map(p => p.y + p.r));
      const dx = areaW / 2 - (bMinX + bMaxX) / 2;
      const dy = areaH / 2 - (bMinY + bMaxY) / 2;
      placed.forEach(p => { p.x += dx; p.y += dy; });

      // 최종 영역 내 체크
      const inBounds = placed.every(p =>
        p.x - p.r >= 1 && p.x + p.r <= areaW - 1 &&
        p.y - p.r >= 1 && p.y + p.r <= areaH - 1
      );
      if (!inBounds) continue;

      return placed.sort((a, b) => a.i - b.i).map(p => ({ x: p.x, y: p.y, r: p.r }));
    }

    // 폴백: 그리드 배치
    const cols = Math.ceil(Math.sqrt(items.length));
    const rows = Math.ceil(items.length / cols);
    const cellW = areaW / cols, cellH = areaH / rows;
    const capR = Math.min(cellW, cellH) / 2 - GAP;
    const fMaxR = Math.min(maxR, capR);
    const fMinR = Math.max(8, fMaxR * 0.4);
    return items.map((it, i) => {
      const ratio = Math.sqrt(it.value / maxVal);
      return {
        x: cellW * (i % cols + 0.5),
        y: cellH * (Math.floor(i / cols) + 0.5),
        r: fMinR + ratio * (fMaxR - fMinR),
      };
    });
  },

  // ── 스캐터 차트 (충성도 비교 등) ──
  scatter(title, subtitle, source, points, xLabel, yLabel, colors) {
    const W = T.W, H = T.H;
    if (!points || points.length === 0) return this._wrap(title, subtitle, source, '');
    const padL = T.EDGE + 60, padR = T.EDGE + 40, padBot = 60;
    const cTop = T.chartTop(!!subtitle), cBot = T.chartBottom();
    const cH = cBot - cTop, cW = W - padL - padR;

    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const xMin = 0, xMax = Math.ceil(Math.max(...xs) * 1.15);
    const yMin = 0, yMax = Math.ceil(Math.max(...ys) * 1.15);
    const xRange = xMax - xMin || 1, yRange = yMax - yMin || 1;

    const toX = v => padL + ((v - xMin) / xRange) * cW;
    const toY = v => cTop + cH - ((v - yMin) / yRange) * cH;

    let svg = '';

    // 평균선 (점선)
    const avgX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
    svg += `<line x1="${toX(avgX)}" y1="${cTop}" x2="${toX(avgX)}" y2="${cBot}" stroke="#E74C3C" stroke-width="1" stroke-dasharray="6,4" opacity="0.5"/>`;
    svg += `<line x1="${padL}" y1="${toY(avgY)}" x2="${W - padR}" y2="${toY(avgY)}" stroke="#E74C3C" stroke-width="1" stroke-dasharray="6,4" opacity="0.5"/>`;

    // 사분면 배경
    const axLine = toX(avgX), ayLine = toY(avgY);
    svg += `<rect x="${padL}" y="${cTop}" width="${axLine - padL}" height="${ayLine - cTop}" fill="rgba(108,92,231,0.03)"/>`;
    svg += `<rect x="${axLine}" y="${cTop}" width="${W - padR - axLine}" height="${ayLine - cTop}" fill="rgba(108,92,231,0.08)"/>`;
    svg += `<rect x="${padL}" y="${ayLine}" width="${axLine - padL}" height="${cBot - ayLine}" fill="rgba(108,92,231,0.05)"/>`;
    svg += `<rect x="${axLine}" y="${ayLine}" width="${W - padR - axLine}" height="${cBot - ayLine}" fill="rgba(108,92,231,0.03)"/>`;

    // 그리드
    const xTicks = 5, yTicks = 5;
    for (let i = 0; i <= xTicks; i++) {
      const v = xMin + (xRange / xTicks) * i, x = toX(v);
      svg += `<line x1="${x}" y1="${cTop}" x2="${x}" y2="${cBot}" stroke="${T.divider}" stroke-width="0.5"/>`;
      svg += `<text x="${x}" y="${cBot + 20}" text-anchor="middle" fill="${T.textMuted}" font-size="12">${v.toFixed(0)}</text>`;
    }
    for (let i = 0; i <= yTicks; i++) {
      const v = yMin + (yRange / yTicks) * i, y = toY(v);
      svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${T.divider}" stroke-width="0.5"/>`;
      svg += `<text x="${padL - 14}" y="${y + 5}" text-anchor="end" fill="${T.textMuted}" font-size="12">${v.toFixed(0)}</text>`;
    }

    // X/Y 축 라벨
    svg += `<text x="${padL + cW / 2}" y="${cBot + 45}" text-anchor="middle" fill="${T.textDark}" font-size="13" font-weight="600">${this._esc(xLabel)}</text>`;
    svg += `<text x="${padL - 50}" y="${cTop + cH / 2}" text-anchor="middle" fill="${T.textDark}" font-size="13" font-weight="600" transform="rotate(-90, ${padL - 50}, ${cTop + cH / 2})">${this._esc(yLabel)}</text>`;

    // 포인트 (원 + 아이콘) — 먼저 그림
    points.forEach((p, i) => {
      const cx = toX(p.x), cy = toY(p.y);
      const r = 22;

      // 원 배경 (흰색)
      svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFFFF" stroke="${T.divider}" stroke-width="1.5"/>`;

      // 아이콘: pkg, iconUrl, 또는 앱 이름(label)으로 검색
      const clipId = `clip-${i}-${Date.now()}`;
      let iconUrl = p.iconUrl || SvgCharts._appIcon(p.pkg) || SvgCharts._appIcon(p.label);
      // URL 검증: http(s), data:image, 로컬 상대경로(icons/), 또는 raw 프록시만 허용
      if (iconUrl && !/^(https?:\/\/|data:image\/|icons\/|\/api\/icon\?)/i.test(iconUrl)) iconUrl = '';
      if (iconUrl) {
        svg += `<defs><clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${r - 2}"/></clipPath></defs>`;
        svg += `<image href="${iconUrl}" x="${cx - r + 2}" y="${cy - r + 2}" width="${(r-2)*2}" height="${(r-2)*2}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice" onerror="this.style.display='none'"/>`;
      } else if (SvgCharts._showAppIcons !== false && p.label && p.label.length >= 2) {
        svg += this._iconSpinner(cx, cy, r - 2);
      }
    });

    // 앱명 라벨 — 나중에 그려서 항상 앞에 보임
    points.forEach((p, i) => {
      const cx = toX(p.x), cy = toY(p.y);
      const r = 22;
      const labelText = this._esc(p.label);
      const labelW = this._textW(p.label, 11) + 16;
      const labelH = 20;
      const labelX = cx - labelW / 2;
      const labelY = cy - r - 22;
      svg += `<rect x="${labelX}" y="${labelY}" width="${labelW}" height="${labelH}" rx="10" fill="rgba(255,255,255,0.85)"/>`;
      svg += `<text x="${cx}" y="${labelY + labelH/2 + 4}" text-anchor="middle" fill="${T.textDark}" font-size="11" font-weight="600">${labelText}</text>`;
    });

    return this._wrap(title, subtitle, source, svg);
  },

  // ── SVG 히트맵 (1200×750 안에 꽉 맞춤) ──
  heatmap(title, subtitle, source, headers, data) {
    const W = T.W, H = T.H;
    const cTop = T.chartTop(!!subtitle) + 10;
    const cBot = T.SOURCE_Y - 10;
    const cH = cBot - cTop;
    const cols = headers.length;
    const rows = data.length;

    // 첫 열 너비: 데이터 길이에 맞게 동적 계산
    const maxLabelLen = Math.max(headers[0].length, ...data.map(r => String(r[0]||'').length));
    const totalW = W - T.EDGE*2;
    const firstColW = Math.min(totalW * 0.28, Math.max(totalW / cols, maxLabelLen * 7.5 + 16));
    const restColW = cols > 1 ? (totalW - firstColW) / (cols - 1) : 0;
    const getColX = ci => T.EDGE + (ci === 0 ? 0 : firstColW + (ci - 1) * restColW);
    const getColW = ci => ci === 0 ? firstColW : restColW;

    const rowH = cH / (rows + 1);
    const fs = Math.min(14, Math.max(8, rowH * 0.4));
    const firstFs = Math.min(fs, Math.max(7, firstColW / (maxLabelLen * 0.65)));
    const startY = cTop;

    let svg = '';

    // 열별로 퍼센트 여부 판단: 해당 열의 유효 숫자가 모두 0~100 범위면 퍼센트
    const colIsPct = headers.map((_, ci) => {
      if (ci === 0) return false;
      const vals = data.map(r => Number(String(r[ci]||'').trim())).filter(v => !isNaN(v) && v !== 0);
      if (vals.length === 0) return false;
      return vals.every(v => v >= 0 && v <= 100);
    });

    // 헤더
    headers.forEach((h, ci) => {
      const x = getColX(ci), w = getColW(ci);
      svg += `<rect x="${x}" y="${startY}" width="${w}" height="${rowH}" fill="#EEEEF6" stroke="${T.divider}" stroke-width="0.5"/>`;
      svg += `<text x="${x + w/2}" y="${startY + rowH/2 + fs*0.35}" text-anchor="middle" font-size="${ci===0?firstFs:fs}" font-weight="600" fill="${T.textDark}">${this._esc(h)}</text>`;
    });
    // 데이터
    data.forEach((r, ri) => {
      const y = startY + (ri + 1) * rowH;
      r.forEach((c, ci) => {
        const x = getColX(ci), w = getColW(ci);
        let bg = T.bg, tc = T.textDark;
        if (ci === 0) {
          svg += `<rect x="${x}" y="${y}" width="${w}" height="${rowH}" fill="#F5F3FF" stroke="${T.divider}" stroke-width="0.5"/>`;
          svg += `<text x="${x + w/2}" y="${y + rowH/2 + firstFs*0.35}" text-anchor="middle" font-size="${firstFs}" font-weight="600" fill="${T.textDark}">${this._esc(c)}</text>`;
        } else {
          const raw = String(c||'').trim();
          const v = Number(raw);
          if (!raw || raw === '-' || raw.toLowerCase() === 'nan' || isNaN(v)) {
            svg += `<rect x="${x}" y="${y}" width="${w}" height="${rowH}" fill="${T.bg}" stroke="${T.divider}" stroke-width="0.5"/>`;
            svg += `<text x="${x + w/2}" y="${y + rowH/2 + fs*0.35}" text-anchor="middle" font-size="${fs}" fill="${T.textMuted}">-</text>`;
          } else {
            const isPct = colIsPct[ci];
            const heatBase = isPct ? v : 0;
            const alpha = isPct ? Math.min(heatBase / 70, 1) : 0;
            if (isPct) {
              bg = `rgba(108,92,231,${(alpha * 0.6 + 0.05).toFixed(2)})`;
              tc = alpha > 0.4 ? '#fff' : '#6B7280';
            } else {
              bg = '#F5F3FF';
              tc = T.textDark;
            }
            const dp = SvgCharts._decimalPlaces;
            const label = isPct ? v.toFixed(dp!=null?dp:1) + '%' : T.fmt(v, dp);
            svg += `<rect x="${x}" y="${y}" width="${w}" height="${rowH}" fill="${bg}" stroke="${T.divider}" stroke-width="0.5"/>`;
            svg += `<text x="${x + w/2}" y="${y + rowH/2 + fs*0.35}" text-anchor="middle" font-size="${fs}" font-weight="500" fill="${tc}">${label}</text>`;
          }
        }
      });
    });
    return this._wrap(title, subtitle, source, svg);
  },

  // ── SVG 테이블 (1200×750 안에 꽉 맞춤) ──
  table(title, subtitle, source, headers, data) {
    const W = T.W, H = T.H;
    const cTop = T.chartTop(!!subtitle) + 10;
    const cBot = T.SOURCE_Y - 10;
    const cH = cBot - cTop;
    const cols = headers.length;
    const rows = data.length;

    // 첫 열 너비: 데이터 길이에 맞게 동적 계산
    const maxLabelLen = Math.max(headers[0].length, ...data.map(r => String(r[0]||'').length));
    const totalW = W - T.EDGE*2;
    const firstColW = Math.min(totalW * 0.28, Math.max(totalW / cols, maxLabelLen * 7.5 + 16));
    const restColW = cols > 1 ? (totalW - firstColW) / (cols - 1) : 0;
    const getColX = ci => T.EDGE + (ci === 0 ? 0 : firstColW + (ci - 1) * restColW);
    const getColW = ci => ci === 0 ? firstColW : restColW;

    const rawRowH = cH / (rows + 1);
    const rowH = Math.min(rawRowH, 60);
    const tableH = rowH * (rows + 1);
    const fs = Math.min(14, Math.max(8, rowH * 0.4));
    const firstFs = Math.min(fs, Math.max(7, firstColW / (maxLabelLen * 0.65)));
    const startY = cTop + (cH - tableH) / 2;

    let svg = '';
    // 헤더
    headers.forEach((h, ci) => {
      const x = getColX(ci), w = getColW(ci);
      svg += `<rect x="${x}" y="${startY}" width="${w}" height="${rowH}" fill="#EEEEF6"/>`;
      svg += `<text x="${x + w/2}" y="${startY + rowH/2 + fs*0.35}" text-anchor="middle" font-size="${ci===0?firstFs:fs}" font-weight="600" fill="${T.textDark}">${this._esc(h)}</text>`;
    });
    // 데이터
    data.forEach((r, ri) => {
      const y = startY + (ri + 1) * rowH;
      const bg = ri % 2 === 0 ? T.bg : '#FAFAFE';
      r.forEach((c, ci) => {
        const x = getColX(ci), w = getColW(ci);
        const isNum = ci > 0 && !isNaN(Number(c));
        svg += `<rect x="${x}" y="${y}" width="${w}" height="${rowH}" fill="${bg}" stroke="${T.divider}" stroke-width="0.5"/>`;
        svg += `<text x="${x + w/2}" y="${y + rowH/2 + fs*0.35}" text-anchor="middle" font-size="${ci===0?firstFs:fs}" font-weight="${ci===0?'600':'400'}" fill="${T.textDark}">${isNum ? T.fmt(Number(c), SvgCharts._decimalPlaces) : this._esc(c)}</text>`;
      });
    });
    return this._wrap(title, subtitle, source, svg);
  },

  // ── 유틸 ──
  _polar(cx,cy,r,deg) { const rad=(deg-90)*Math.PI/180; return {x:cx+r*Math.cos(rad), y:cy+r*Math.sin(rad)}; },

  // 패키지명 또는 앱명 → 앱 아이콘 URL (로컬 icons/ 폴더 + API 캐시)
  // 아이콘 없을 때 기본 플레이스홀더 (앱 이름 첫 글자)
  _iconPlaceholder(cx, cy, r, label) {
    const initial = (label || '?').charAt(0);
    const tooltip = `"${this._esc(label)}" 아이콘을 찾을 수 없습니다 (검색 결과 없음)`;
    return `<g><title>${tooltip}</title>` +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#F3F0FF" stroke="${T.divider}" stroke-width="1.5" style="cursor:help"/>` +
      `<text x="${cx}" y="${cy + r * 0.35}" text-anchor="middle" font-size="${r * 0.9}" fill="#8B7FC7" font-weight="600" style="cursor:help">${this._esc(initial)}</text></g>`;
  },

  // 아이콘 없을 때 로딩 스피너 SVG (원형 회전 애니메이션)
  _iconSpinner(cx, cy, r) {
    const sr = Math.max(8, r * 0.45);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#F3F0FF" stroke="${T.divider}" stroke-width="1.5"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${sr}" fill="none" stroke="#C4B5FD" stroke-width="2.5" stroke-dasharray="${sr * 3.14}" stroke-dashoffset="${sr * 1.57}" stroke-linecap="round">` +
      `<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="1s" repeatCount="indefinite"/></circle>`;
  },

  _iconCache: (function() {
    try {
      var cache = JSON.parse(localStorage.getItem('cs-icon-cache') || '{}');
      // base64, 로컬 아이콘만 유지. 나머지(외부 URL, 프록시 URL, 'none') 삭제
      var cleaned = false;
      for (var k in cache) {
        var v = cache[k];
        if (!v || v === 'none' || (!v.startsWith('data:') && !v.startsWith('icons/'))) {
          delete cache[k];
          cleaned = true;
        }
      }
      if (cleaned) localStorage.setItem('cs-icon-cache', JSON.stringify(cache));
      return cache;
    } catch(e) { return {}; }
  })(),

  _appIcon(nameOrPkg) {
    if (SvgCharts._showAppIcons === false) return '';
    const map = {
      'com.netflix.mediaclient': 'icons/netflix.png',
      'net.cj.cjhv.gs.tving': 'icons/tving.png',
      'kr.co.captv.pooqV2': 'icons/wavve.png',
      'com.coupang.mobile.play': 'icons/coupangplay.png',
      'com.disney.disneyplus': 'icons/disneyplus.png',
      'com.frograms.wplay': 'icons/watcha.png',
      // 앱명으로도 매핑
      'Netflix(넷플릭스)': 'icons/netflix.png',
      '넷플릭스': 'icons/netflix.png',
      'Netflix': 'icons/netflix.png',
      'TVING': 'icons/tving.png',
      '티빙': 'icons/tving.png',
      'Wavve (웨이브)': 'icons/wavve.png',
      '웨이브': 'icons/wavve.png',
      'Wavve': 'icons/wavve.png',
      '쿠팡플레이': 'icons/coupangplay.png',
      'Coupang Play': 'icons/coupangplay.png',
      'Disney+': 'icons/disneyplus.png',
      '디즈니+': 'icons/disneyplus.png',
      '왓챠': 'icons/watcha.png',
      'Watcha': 'icons/watcha.png',
    };
    var cached = this._iconCache[nameOrPkg];
    var validCached = (cached && cached !== 'none' && (cached.startsWith('data:') || cached.startsWith('icons/') || (cached.includes('/api/icon?') && cached.includes('raw=1')))) ? cached : '';
    return map[nameOrPkg] || validCached || '';
  },

  // 아이콘이 없는 것으로 확정된 앱인지 확인
  _iconNotFound(name) {
    return this._iconCache[name] === 'none';
  },

  // API로 앱 아이콘 URL을 미리 로드 (배치 API로 한 번에 요청)
  async preloadAppIcons(appNames) {
    if (!appNames || appNames.length === 0) return;

    const toFetch = appNames.filter(name => name && !this._appIcon(name));
    if (toFetch.length === 0) return;

    // 긴 앱 이름에서 검색용 키워드 추출
    const _searchKeyword = (name) => {
      // 괄호 안 내용 제거, 하이픈/대시 이후 제거
      let kw = name.replace(/\s*[\(\[（][^)）\]]*[\)）\]]?\s*/g, '').replace(/\s*[-–—].*$/g, '').trim();
      if (kw.length > 20) kw = kw.slice(0, 15).trim();
      if (kw.length < 2) kw = name.replace(/[^a-zA-Z가-힣0-9\s]/g, '').trim().slice(0, 15);
      if (kw.length < 2) kw = name.slice(0, 10).trim();
      return kw;
    };

    // 검색 결과에서 가장 잘 맞는 앱 찾기
    const _bestMatch = (list, name) => {
      if (!list || list.length === 0) return null;
      const lower = name.toLowerCase();
      // 정확히 일치
      const exact = list.find(a => (a.appName || '').toLowerCase() === lower);
      if (exact) return exact;
      // 앱 이름이 포함
      const partial = list.find(a => {
        const an = (a.appName || '').toLowerCase();
        return an.includes(lower) || lower.includes(an);
      });
      if (partial) return partial;
      // 첫 단어 매칭
      const firstWord = lower.replace(/[^a-z가-힣0-9]/g, '').slice(0, 4);
      if (firstWord.length >= 2) {
        const wordMatch = list.find(a => (a.appName || '').toLowerCase().replace(/[^a-z가-힣0-9]/g, '').includes(firstWord));
        if (wordMatch) return wordMatch;
      }
      return list[0];
    };

    // 키워드 → 원본 이름 매핑
    const kwMap = {};
    const keywords = [];
    toFetch.forEach(name => {
      const kw = _searchKeyword(name);
      if (!kwMap[kw]) kwMap[kw] = [];
      kwMap[kw].push(name);
      if (!keywords.includes(kw)) keywords.push(kw);
    });

    try {
      // 3개씩 나눠서 순차 요청
      const CHUNK = 3;
      const allResults = {};
      for (let i = 0; i < keywords.length; i += CHUNK) {
        const chunk = keywords.slice(i, i + CHUNK);
        try {
          const resp = await fetch(ApiClient.BASE_URL + '/search-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keywords: chunk })
          });
          if (resp.ok) {
            const json = await resp.json();
            Object.assign(allResults, json.data || {});
          }
        } catch(e) { /* 청크 실패 무시, 다음 청크 계속 */ }
        // 진행 콜백
        if (this._onIconProgress) {
          const done = Math.min(i + CHUNK, keywords.length);
          this._onIconProgress(done, keywords.length, allResults);
        }
      }
      console.log('[아이콘] 검색 키워드:', keywords, '응답 키:', Object.keys(allResults));
      for (const [kw, names] of Object.entries(kwMap)) {
        const list = allResults[kw];
          console.log('[아이콘]', kw, '→', list ? list.length + '개 결과' : '결과 없음');
          names.forEach(name => {
            if (!list || list.length === 0) {
              return;
            }
            const app = _bestMatch(list, name);
            if (app) {
              // base64 아이콘 우선, 없으면 프록시 URL
              const iconB64 = app.iconBase64 || '';
              const finalIcon = iconB64;
              if (finalIcon) {
                console.log('[아이콘] ✅', name, '→', finalIcon.startsWith('data:') ? 'base64(' + finalIcon.length + ')' : finalIcon.slice(0, 60));
                this._iconCache[name] = finalIcon;
                const pkg = app.pkgName || app.pkg_name || '';
                if (pkg) this._iconCache[pkg] = finalIcon;
                const appName = app.appName || '';
                if (appName && appName !== name) this._iconCache[appName] = finalIcon;
              } else {
                console.log('[아이콘] ❌', name, '→ 아이콘 URL 없음');
              }
            } else {
              console.log('[아이콘] ❌', name, '→ 매칭 앱 없음');
            }
          });
        }
        try { localStorage.setItem('cs-icon-cache', JSON.stringify(this._iconCache)); } catch(e) {}
    } catch(e) { /* 무시 */ }
  },
  // ── 아이콘 크기/모양 유틸리티 ──
  _iconMetrics(sizeKey) {
    var map = {
      small:  { radius: 8,  padding: 4,  imgOffset: 1 },
      medium: { radius: 12, padding: 6,  imgOffset: 1 },
      large:  { radius: 16, padding: 8,  imgOffset: 2 },
    };
    return map[sizeKey] || map.medium;
  },

  _renderIcon(url, cx, cy, metrics, shape, uniqueId) {
    var r = metrics.radius;
    var off = metrics.imgOffset;
    var validShape = (shape === 'circle' || shape === 'square') ? shape : 'circle';

    if (!url) {
      return this._iconSpinner(cx, cy, r);
    }

    var svg = '';
    svg += '<defs><clipPath id="' + uniqueId + '">';
    if (validShape === 'square') {
      var cornerR = Math.max(2, r * 0.25);
      svg += '<rect x="' + (cx - r + off) + '" y="' + (cy - r + off) + '" width="' + ((r - off) * 2) + '" height="' + ((r - off) * 2) + '" rx="' + cornerR + '"/>';
    } else {
      svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - off) + '"/>';
    }
    svg += '</clipPath></defs>';

    if (validShape === 'square') {
      var cornerR2 = Math.max(2, r * 0.25);
      svg += '<rect x="' + (cx - r) + '" y="' + (cy - r) + '" width="' + (r * 2) + '" height="' + (r * 2) + '" rx="' + cornerR2 + '" fill="#FFF" stroke="' + T.divider + '" stroke-width="0.8"/>';
    } else {
      svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#FFF" stroke="' + T.divider + '" stroke-width="0.8"/>';
    }

    svg += '<image href="' + url + '" x="' + (cx - r + off) + '" y="' + (cy - r + off) + '" width="' + ((r - off) * 2) + '" height="' + ((r - off) * 2) + '" clip-path="url(#' + uniqueId + ')" preserveAspectRatio="xMidYMid slice"/>';
    return svg;
  },

  _chartBottomWithIcons(hasIcons, sizeKey) {
    var base = T.chartBottom();
    if (!hasIcons) return base;
    var m = this._iconMetrics(sizeKey);
    return base - (m.radius * 2 + m.padding);
  },

  _smooth(pts) {
    if (pts.length<2) return '';
    let d = `M ${pts[0][0]},${pts[0][1]}`;
    for (let i=1;i<pts.length;i++) { const p=pts[i-1],c=pts[i],cx=(p[0]+c[0])/2; d+=` C ${cx},${p[1]} ${cx},${c[1]} ${c[0]},${c[1]}`; }
    return d;
  },
  _smoothArea(pts, by) { if(pts.length<2) return ''; return `${this._smooth(pts)} L ${pts[pts.length-1][0]},${by} L ${pts[0][0]},${by} Z`; },
};
