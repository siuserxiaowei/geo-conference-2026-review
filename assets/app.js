(function () {
  'use strict';

  const DATA = window.GEO_DATA;
  if (!DATA) {
    document.getElementById('app').innerHTML =
      '<div class="card"><h1>数据加载失败</h1><p>请确认 assets/data.js 已生成。</p></div>';
    return;
  }

  const { sessions, synthesis, generatedAt } = DATA;

  const TOPIC_MAP = new Map();
  for (const t of synthesis.topics) TOPIC_MAP.set(t.id, t);

  const TALK_MAP = new Map();
  const SESSION_MAP = new Map();
  for (const s of sessions) {
    SESSION_MAP.set(s.id, s);
    for (let i = 0; i < (s.talks || []).length; i++) {
      const talk = s.talks[i];
      TALK_MAP.set(talk.id, {
        ...talk,
        sessionId: s.id,
        sessionTitle: s.title,
        sessionSubtitle: s.subtitle,
        miaojiId: s.miaojiId,
        indexInSession: i,
      });
    }
  }

  const KIND_LABEL = {
    talk: '主题演讲',
    panel: '圆桌对话',
    lightning: '5分钟快分享',
  };

  function esc(val) {
    return String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function miaojiUrl(miaojiId, ts) {
    const parts = String(ts || '00:00:00').split(':').map(Number);
    const sec = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    return `https://qjr6h2amuu.feishu.cn/minutes/${encodeURIComponent(miaojiId)}?t=${sec * 1000}`;
  }

  function tsAnchor(miaojiId, ts, showPermHint) {
    if (!miaojiId || !ts) return '';
    const url = miaojiUrl(miaojiId, ts);
    return `<a class="ts-link" href="${esc(url)}" target="_blank" rel="noopener" title="点击打开飞书妙记原声（需飞书权限）">▶ ${esc(ts)}</a>${
      showPermHint ? '<span class="ts-perm-note">需飞书权限</span>' : ''
    }`;
  }

  function talkTsAnchor(talkId, ts, showPermHint) {
    const talk = TALK_MAP.get(talkId);
    if (!talk || !ts) return '';
    return tsAnchor(talk.miaojiId, ts, showPermHint);
  }

  function tagBadge(topicId) {
    const t = TOPIC_MAP.get(topicId);
    return `<a class="tag" href="#/topic/${esc(topicId)}">${esc(t ? t.title : topicId)}</a>`;
  }

  function kindBadge(kind) {
    const cls = kind === 'panel' ? 'tag tag-accent' : kind === 'lightning' ? 'tag tag-ok' : 'tag';
    return `<span class="${cls}">${esc(KIND_LABEL[kind] || kind)}</span>`;
  }

  // LocalStorage state helpers
  function loadState(key, fallback) {
    try {
      const raw = localStorage.getItem(`geo26:${key}`);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveState(key, val) {
    try {
      localStorage.setItem(`geo26:${key}`, JSON.stringify(val));
    } catch {
      // ignore storage quota errors
    }
  }

  // Toast
  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 2000);
  }

  function copyText(text, okMsg = '已复制') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showToast(okMsg),
        () => fallbackCopy(text, okMsg)
      );
    } else {
      fallbackCopy(text, okMsg);
    }
  }

  function fallbackCopy(text, okMsg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast(okMsg);
    } catch {
      showToast('复制失败，请手动选中文本');
    }
    document.body.removeChild(ta);
  }

  // Navigation structure
  const NAV_GROUPS = [
    {
      label: '会议主干',
      items: [
        { route: '#/', label: '全景首页', badge: '总览' },
        { route: '#/sessions', label: '四大场次', badge: `${TALK_MAP.size}讲` },
        { route: '#/topics', label: '十大主题', badge: `${synthesis.topics.length}` },
      ],
    },
    {
      label: '深度拆解',
      items: [
        { route: '#/methods', label: '方法论对照', badge: `${synthesis.methods.length}套` },
        { route: '#/debates', label: '观点碰撞', badge: `${synthesis.debates.length}组` },
        { route: '#/quotes', label: '金句卡片墙', badge: `${synthesis.quotes.length}` },
      ],
    },
    {
      label: '学习与落地',
      items: [
        { route: '#/paths', label: '三条学习路径', badge: '打卡' },
        { route: '#/quiz', label: '20题自测', badge: `${synthesis.quiz.length}题` },
        { route: '#/checklist', label: '行动清单', badge: `${synthesis.checklist.length}项` },
      ],
    },
    {
      label: '工具箱',
      items: [
        { route: '#/resources', label: '会后物料', badge: `${synthesis.resources.length}` },
        { route: '#/glossary', label: '术语与纠错', badge: 'ASR' },
      ],
    },
  ];

  function renderNav(activeHash) {
    const norm = activeHash === '' ? '#/' : activeHash;
    const isMatch = (route) => {
      if (route === '#/') return norm === '#/';
      if (route === '#/topics' && norm.startsWith('#/topic/')) return true;
      if (route === '#/sessions' && norm.startsWith('#/talk/')) return true;
      return norm === route;
    };

    const sidebarHtml = `<div class="sidebar-sticky">${NAV_GROUPS.map(
      (g) => `
      <div class="nav-group-label">${esc(g.label)}</div>
      ${g.items
        .map(
          (it) =>
            `<a class="nav-link${isMatch(it.route) ? ' active' : ''}" href="${esc(it.route)}">
              <span>${esc(it.label)}</span>
              <span class="nav-badge">${esc(it.badge)}</span>
            </a>`
        )
        .join('')}
    `
    ).join('')}</div>`;

    const drawerHtml = `<div class="drawer-grid">${NAV_GROUPS.flatMap((g) => g.items)
      .map(
        (it) =>
          `<a class="nav-link${isMatch(it.route) ? ' active' : ''}" href="${esc(it.route)}">
            <span>${esc(it.label)}</span>
            <span class="nav-badge">${esc(it.badge)}</span>
          </a>`
      )
      .join('')}</div>`;

    document.getElementById('sidebar').innerHTML = sidebarHtml;
    document.getElementById('mobileDrawer').innerHTML = drawerHtml;
  }

  // Build global search index once
  const SEARCH_INDEX = [];
  function addIndex(kind, title, text, route, meta) {
    const clean = String(text || '').trim();
    if (!clean) return;
    SEARCH_INDEX.push({ kind, title, text: clean, lower: `${title}\n${clean}`.toLowerCase(), route, meta });
  }

  for (const s of sessions) {
    for (const n of s.sessionNotes || []) {
      addIndex('场次花絮', `${s.title} · 主持与串场`, n.text, '#/sessions', n.ts);
    }
    for (const t of s.talks || []) {
      const route = `#/talk/${t.id}`;
      addIndex('嘉宾', `${t.speaker} · ${t.org}`, `${t.title} ${t.bio} ${t.oneLiner}`, route, s.title);
      for (const kp of t.keyPoints || []) addIndex('要点', `${t.speaker}：${t.title}`, kp.text, route, kp.ts);
      for (const m of t.methods || []) addIndex('方法', `${t.speaker} · ${m.name}`, (m.steps || []).join(' '), route, s.title);
      for (const d of t.data || []) addIndex('数据', `${t.speaker} · ${d.value}`, d.label, route, d.ts);
      for (const c of t.cases || []) addIndex('案例', `${t.speaker} · ${c.title}`, c.detail, route, c.ts);
      for (const q of t.quotes || []) addIndex('原话', `${t.speaker} 原声`, q.text, route, q.ts);
      for (const qa of t.qa || []) addIndex('问答', `${t.speaker} 问答`, `${qa.q} ${qa.a}`, route, qa.ts);
      for (const r of t.resources || []) addIndex('资源', `${t.speaker} · ${r.item}`, r.how, route, s.title);
      for (const u of t.uncertain || []) addIndex('核实备注', `${t.speaker} 存疑核实`, u, route, s.title);
    }
  }
  for (const tp of synthesis.topics) {
    const route = `#/topic/${tp.id}`;
    addIndex('主题', tp.title, `${tp.subtitle} ${tp.summary}`, route, '十大主线');
    for (const pt of tp.points || []) addIndex('主题要点', tp.title, pt.text, route, '十大主线');
  }
  for (const m of synthesis.methods) {
    addIndex('方法论', `${m.name}（${m.speaker}）`, `${m.focus} ${(m.steps || []).join(' ')}`, '#/methods', m.org);
  }
  for (const db of synthesis.debates) {
    const allClaims = [...db.sideA, ...db.sideB].map((x) => `${x.speaker}: ${x.claim}`).join(' ');
    addIndex('观点碰撞', db.title, `${db.context} ${allClaims} ${db.synthesis}`, '#/debates', '交锋');
  }
  for (const q of synthesis.quotes) {
    addIndex('金句', `${q.speaker}（${q.org}）`, `${q.text} ${q.note}`, '#/quotes', q.ts);
  }
  for (const a of synthesis.glossary.asrCorrections) {
    addIndex('纠错', `${a.raw} → ${a.standard}`, a.note, '#/glossary', 'ASR纠错');
  }
  for (const tm of synthesis.glossary.terms) {
    addIndex('术语', tm.term, `${tm.category} ${tm.desc}`, '#/glossary', tm.category);
  }
  for (const ck of synthesis.checklist) {
    addIndex('清单', `${ck.category} · ${ck.text}`, ck.detail, '#/checklist', ck.category);
  }

  function highlightMatch(text, query) {
    const q = query.trim();
    if (!q) return esc(text);
    const reSafe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${reSafe})`, 'ig');
    const parts = String(text).split(re);
    return parts
      .map((part, idx) => (idx % 2 === 1 ? `<mark>${esc(part)}</mark>` : esc(part)))
      .join('');
  }

  function makeSnippet(text, query) {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return text.slice(0, 95) + (text.length > 95 ? '…' : '');
    const start = Math.max(0, idx - 26);
    const end = Math.min(text.length, idx + query.length + 62);
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }

  // Page Renderers
  function renderHome() {
    const { overview, dataWall, paths } = synthesis;
    const fiveMinuteSummary = overview.fiveMinuteSummary || [];
    const pathChecks = loadState('paths', {});
    const showAllData = loadState('homeShowAllData', false);
    const wallItems = showAllData ? dataWall : dataWall.slice(0, 12);

    return `
    <div class="page-wide">
      <header class="masthead reveal">
        <div class="masthead-kicker">
          <span>2026·11·21 · 深圳</span>
          <span>第二届中国 GEO 大会</span>
          <span>白昼四大场次 · 逐字稿深读复盘</span>
        </div>
        <h1>${esc(overview.title)}</h1>
        <p class="masthead-sub">${esc(overview.subtitle)} — ${esc(overview.positioning)}</p>

        <div class="facts-strip">
          <div class="fact-cell"><div class="fact-label">时间</div><div class="fact-val">${esc(overview.date)}</div></div>
          <div class="fact-cell"><div class="fact-label">参会规模</div><div class="fact-val">${esc(overview.scale)}</div></div>
          <div class="fact-cell"><div class="fact-label">内容覆盖</div><div class="fact-val">${esc(overview.guestCount)}</div></div>
          <div class="fact-cell"><div class="fact-label">会前收集 &amp; 下一站</div><div class="fact-val">${esc(overview.preQuestionsCount)} · ${esc(overview.nextEdition)}</div></div>
        </div>

        <div class="tag-row">
          <span class="tag tag-accent">会前107问高频TOP</span>
          ${(overview.topConcerns || []).map((c) => `<span class="tag">${esc(c)}</span>`).join('')}
        </div>
      </header>

      <section class="reveal reveal-d1">
        <div class="section-head">
          <h2>5 分钟看懂今天</h2>
          <span class="section-sub">先建立全景认知，再按路径深挖</span>
        </div>
        <div class="five-grid">
          ${fiveMinuteSummary
            .map(
              (item) => `
            <article class="card five-card">
              <div class="five-num">${esc(item.num)}</div>
              <h3>${esc(item.title)}</h3>
              <p>${esc(item.text)}</p>
            </article>`
            )
            .join('')}
        </div>
      </section>

      <section class="reveal reveal-d2">
        <div class="section-head">
          <h2>学习路径入口</h2>
          <a class="tag" href="#/paths">进入全部路径与打卡 →</a>
        </div>
        <div class="talk-grid">
          ${paths
            .map((p) => {
              const done = p.steps.filter((st) => pathChecks[st.id]).length;
              const pct = Math.round((done / p.steps.length) * 100);
              return `
              <a class="card card-link" href="#/paths">
                <div class="talk-card-top">
                  <strong>${esc(p.title)}</strong>
                  <span class="tag tag-accent">${esc(p.duration)}</span>
                </div>
                <p class="talk-org">${esc(p.audience)}</p>
                <p class="talk-oneliner">${esc(p.desc)}</p>
                <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
                <div class="talk-time" style="margin-top:0.4rem">已打卡 ${done}/${p.steps.length} 步 (${pct}%)</div>
              </a>`;
            })
            .join('')}
        </div>
      </section>

      <section class="reveal reveal-d3">
        <div class="section-head">
          <h2>全天时间轴 · 四大场次 18 场分享</h2>
          <a class="tag" href="#/sessions">查看场次笔记与主持串场 →</a>
        </div>
        ${sessions
          .map(
            (s) => `
          <div class="session-block">
            <div class="session-banner">
              <span class="session-banner-title">${esc(s.title)} · ${esc(s.subtitle)}</span>
              <span class="session-banner-meta">${esc(s.time)} · ${(s.talks || []).length} 场</span>
            </div>
            <div class="talk-grid">
              ${(s.talks || [])
                .map(
                  (t) => `
                <a class="card card-link" href="#/talk/${esc(t.id)}">
                  <div class="talk-card-top">
                    <span class="talk-speaker">${esc(t.speaker)}</span>
                    ${kindBadge(t.kind)}
                  </div>
                  <div class="talk-org">${esc(t.org)}</div>
                  <p class="talk-oneliner">${esc(t.oneLiner)}</p>
                  <div class="talk-card-top">
                    <span class="talk-time">${esc(t.start)}–${esc(t.end)}</span>
                    ${t.nameConfidence !== 'high' ? '<span class="tag tag-warn">待核实</span>' : ''}
                  </div>
                </a>`
                )
                .join('')}
            </div>
          </div>`
          )
          .join('')}
      </section>

      <section class="reveal reveal-d4">
        <div class="section-head">
          <h2>高密度数据墙精选（${wallItems.length}/${dataWall.length}）</h2>
          <div>
            <span class="ts-perm-note">▶ 时间戳直达原声（需飞书权限）</span>
          </div>
        </div>
        <div class="data-wall">
          ${wallItems
            .map(
              (d) => `
            <article class="data-card">
              <div>
                <div class="tag-row" style="margin-top:0;margin-bottom:0.35rem"><span class="tag">${esc(d.category)}</span></div>
                <div class="data-num">${esc(d.value)}</div>
                <div class="data-label">${esc(d.label)}</div>
              </div>
              <div class="data-foot">
                <a href="#/talk/${esc(d.talkId)}">${esc(d.speaker)} →</a>
                ${talkTsAnchor(d.talkId, d.ts, false)}
              </div>
            </article>`
            )
            .join('')}
        </div>
        <div style="margin-top:0.85rem">
          <button type="button" class="btn btn-outline" id="toggleAllDataBtn">
            ${showAllData ? '收起为精选前 12 条' : `展开全部 ${dataWall.length} 条逐字稿核实数据`}
          </button>
        </div>
      </section>

      <section class="reveal reveal-d5" style="margin-top:1.75rem">
        <details class="editorial-details">
          <summary>嘉宾与产品名单核实说明（以逐字稿自述为准）</summary>
          <ul>
            ${(overview.nameAuditNotice || []).map((line) => `<li>${esc(line)}</li>`).join('')}
          </ul>
        </details>
      </section>
    </div>`;
  }

  function renderSessions() {
    return `
    <div class="page-wide">
      <div class="page-header reveal">
        <div class="page-kicker">全天四大场次 · 按时间顺序浏览</div>
        <h1>场次与嘉宾目录</h1>
        <p class="page-desc">共收录 4 场 18 个讲者单元（13 场主题演讲 + 1 场三人圆桌 + 4 位五分钟快分享）。展开各场“串联与花絮”可查看费曼作业、合影及会场突发细节。<span class="ts-perm-note">点击 ▶ 时间戳可跳飞书原声（需飞书权限）</span></p>
      </div>
      ${sessions
        .map(
          (s) => `
        <section class="session-block reveal">
          <div class="session-banner">
            <span class="session-banner-title">${esc(s.title)} · ${esc(s.subtitle)}</span>
            <span class="session-banner-meta">${esc(s.time)} · 妙记 ${esc(s.miaojiId)}</span>
          </div>
          ${
            (s.sessionNotes || []).length
              ? `<details class="editorial-details">
                  <summary>本场主持串场、互动与现场花絮（${s.sessionNotes.length} 条）</summary>
                  <ul>
                    ${s.sessionNotes
                      .map((n) => `<li>${esc(n.text)} ${tsAnchor(s.miaojiId, n.ts, false)}</li>`)
                      .join('')}
                  </ul>
                </details>`
              : ''
          }
          <div class="talk-grid">
            ${(s.talks || [])
              .map(
                (t) => `
              <article class="card card-link" onclick="location.hash='#/talk/${esc(t.id)}'" style="cursor:pointer">
                <div class="talk-card-top">
                  <a class="talk-speaker" href="#/talk/${esc(t.id)}">${esc(t.speaker)}</a>
                  <div style="display:flex;gap:0.3rem;align-items:center">
                    ${t.nameConfidence !== 'high' ? '<span class="tag tag-warn">待核实</span>' : ''}
                    ${kindBadge(t.kind)}
                  </div>
                </div>
                <div class="talk-org">${esc(t.org)} · <span class="talk-time">${esc(t.start)}–${esc(t.end)}</span></div>
                <div style="font-weight:600;font-size:0.93rem;margin-bottom:0.3rem">${esc(t.title)}</div>
                <p class="talk-oneliner">${esc(t.oneLiner)}</p>
                <div class="tag-row" onclick="event.stopPropagation()">
                  ${(t.tags || []).map(tagBadge).join('')}
                </div>
              </article>`
              )
              .join('')}
          </div>
        </section>`
        )
        .join('')}
    </div>`;
  }

  function renderTalkDetail(talkId) {
    const t = TALK_MAP.get(talkId);
    if (!t) return renderHome();

    const sess = SESSION_MAP.get(t.sessionId);
    const prevTalk = t.indexInSession > 0 ? sess.talks[t.indexInSession - 1] : null;
    const nextTalk = t.indexInSession < sess.talks.length - 1 ? sess.talks[t.indexInSession + 1] : null;

    return `
    <div class="page-narrow">
      <div style="margin-bottom:0.85rem;font-size:0.85rem;color:var(--muted)">
        <a href="#/sessions">← 返回场次目录</a> · ${esc(t.sessionTitle)}（${esc(sess.time)}）
      </div>

      <article class="talk-hero reveal">
        <div class="talk-card-top">
          <div style="display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center">
            ${kindBadge(t.kind)}
            ${t.nameConfidence !== 'high' ? '<span class="tag tag-warn">姓名/机构待核实</span>' : ''}
            ${tsAnchor(t.miaojiId, t.start, true)}
          </div>
          <span class="talk-time">${esc(t.start)} – ${esc(t.end)}</span>
        </div>
        <h1 style="font-family:var(--font-serif);font-size:clamp(1.45rem,3.4vw,2.15rem);margin:0.65rem 0 0.35rem;line-height:1.25">${esc(t.title)}</h1>
        <div style="font-size:1rem;font-weight:700">${esc(t.speaker)} <span style="font-weight:400;color:var(--muted)">· ${esc(t.org)}</span></div>
        <p class="talk-bio">${esc(t.bio)}</p>
        <div class="tag-row">${(t.tags || []).map(tagBadge).join('')}</div>
      </article>

      <div class="oneliner-box reveal reveal-d1">
        <div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--accent);margin-bottom:0.25rem">一句话核心命题</div>
        ${esc(t.oneLiner)}
      </div>

      <section class="reveal reveal-d2">
        <div class="section-head">
          <h2>核心要点（${(t.keyPoints || []).length}）</h2>
          <span class="section-sub">点击 ▶ 时间戳跳原声（需飞书权限）</span>
        </div>
        <ol class="kp-list">
          ${(t.keyPoints || [])
            .map(
              (kp, idx) => `
            <li class="kp-item">
              <span class="kp-idx">${String(idx + 1).padStart(2, '0')}</span>
              <div class="kp-body">
                <span>${esc(kp.text)}</span>
                <span style="margin-left:0.35rem">${tsAnchor(t.miaojiId, kp.ts, false)}</span>
              </div>
            </li>`
            )
            .join('')}
        </ol>
      </section>

      ${
        (t.methods || []).length
          ? `<section class="reveal reveal-d3">
              <div class="section-head"><h2>方法论与操作步骤</h2></div>
              <div style="display:flex;flex-direction:column;gap:0.85rem">
                ${t.methods
                  .map(
                    (m) => `
                  <div class="card">
                    <h3 style="font-family:var(--font-serif);margin:0;font-size:1.08rem">${esc(m.name)}</h3>
                    <ol class="method-steps">
                      ${(m.steps || []).map((st) => `<li><span>${esc(st)}</span></li>`).join('')}
                    </ol>
                  </div>`
                  )
                  .join('')}
              </div>
            </section>`
          : ''
      }

      ${
        (t.data || []).length
          ? `<section>
              <div class="section-head"><h2>关键数据（${t.data.length}）</h2></div>
              <div class="data-wall">
                ${t.data
                  .map(
                    (d) => `
                  <div class="data-card">
                    <div>
                      <div class="data-num">${esc(d.value)}</div>
                      <div class="data-label">${esc(d.label)}</div>
                    </div>
                    <div class="data-foot">
                      <span>数据锚点</span>
                      ${tsAnchor(t.miaojiId, d.ts, false)}
                    </div>
                  </div>`
                  )
                  .join('')}
              </div>
            </section>`
          : ''
      }

      ${
        (t.cases || []).length
          ? `<section>
              <div class="section-head"><h2>实操案例（${t.cases.length}）</h2></div>
              <div style="display:flex;flex-direction:column;gap:0.75rem">
                ${t.cases
                  .map(
                    (c) => `
                  <div class="card">
                    <div class="talk-card-top">
                      <strong>${esc(c.title)}</strong>
                      ${tsAnchor(t.miaojiId, c.ts, false)}
                    </div>
                    <p style="margin:0.35rem 0 0;font-size:0.92rem">${esc(c.detail)}</p>
                  </div>`
                  )
                  .join('')}
              </div>
            </section>`
          : ''
      }

      ${
        (t.quotes || []).length
          ? `<section>
              <div class="section-head">
                <h2>逐字稿原话摘录</h2>
                <span class="section-sub">点击卡片即可复制</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:0.75rem">
                ${t.quotes
                  .map(
                    (q) => `
                  <div class="quote-card copyable-quote" data-quote="${esc(q.text)}" data-speaker="${esc(t.speaker)}">
                    <span class="quote-mark">“</span>
                    <p class="quote-text">${esc(q.text)}</p>
                    <div class="quote-foot">
                      <span>点击复制原话</span>
                      <span onclick="event.stopPropagation()">${tsAnchor(t.miaojiId, q.ts, false)}</span>
                    </div>
                  </div>`
                  )
                  .join('')}
              </div>
            </section>`
          : ''
      }

      ${
        (t.qa || []).length
          ? `<section>
              <div class="section-head"><h2>现场问答（${t.qa.length}）</h2></div>
              <div style="display:flex;flex-direction:column;gap:0.75rem">
                ${t.qa
                  .map(
                    (item) => `
                  <div class="card">
                    <div class="talk-card-top">
                      <span class="tag tag-accent">Q 现场提问</span>
                      ${tsAnchor(t.miaojiId, item.ts, false)}
                    </div>
                    <p style="font-weight:600;margin:0.45rem 0">${esc(item.q)}</p>
                    <p style="margin:0;font-size:0.92rem;color:var(--muted)"><strong style="color:var(--ink)">A：</strong>${esc(item.a)}</p>
                  </div>`
                  )
                  .join('')}
              </div>
            </section>`
          : ''
      }

      ${
        (t.resources || []).length
          ? `<section>
              <div class="section-head"><h2>提及资料与工具</h2></div>
              <div style="display:flex;flex-direction:column;gap:0.65rem">
                ${t.resources
                  .map(
                    (r) => `
                  <div class="card">
                    <strong>${esc(r.item)}</strong>
                    <p style="margin:0.3rem 0 0;font-size:0.9rem;color:var(--muted)">${esc(r.how)}</p>
                  </div>`
                  )
                  .join('')}
              </div>
            </section>`
          : ''
      }

      ${
        (t.uncertain || []).length
          ? `<section style="margin-top:1.5rem">
              <details class="editorial-details">
                <summary>识别与核实备注（${t.uncertain.length} 条）</summary>
                <ul>
                  ${t.uncertain.map((u) => `<li>${esc(u)}</li>`).join('')}
                </ul>
              </details>
            </section>`
          : ''
      }

      <section style="margin-top:1.5rem">
        <div style="font-size:0.84rem;color:var(--muted);margin-bottom:0.45rem">所属核心主题：</div>
        <div class="tag-row">${(t.tags || []).map(tagBadge).join('')}</div>
      </section>

      <nav class="talk-pager" aria-label="同场上下位切换">
        ${
          prevTalk
            ? `<a class="pager-link" href="#/talk/${esc(prevTalk.id)}">
                <span class="pager-dir">← 同场上一位</span>
                <strong>${esc(prevTalk.speaker)}</strong>
                <span style="font-size:0.82rem;color:var(--muted)">${esc(prevTalk.title)}</span>
              </a>`
            : `<a class="pager-link" href="#/sessions">
                <span class="pager-dir">← 返回</span>
                <strong>${esc(t.sessionTitle)} 开篇</strong>
                <span style="font-size:0.82rem;color:var(--muted)">浏览全天所有场次</span>
              </a>`
        }
        ${
          nextTalk
            ? `<a class="pager-link" href="#/talk/${esc(nextTalk.id)}">
                <span class="pager-dir">同场下一位 →</span>
                <strong>${esc(nextTalk.speaker)}</strong>
                <span style="font-size:0.82rem;color:var(--muted)">${esc(nextTalk.title)}</span>
              </a>`
            : `<a class="pager-link" href="#/sessions">
                <span class="pager-dir">本场结束 →</span>
                <strong>返回场次目录</strong>
                <span style="font-size:0.82rem;color:var(--muted)">继续查看其他场次</span>
              </a>`
        }
      </nav>
    </div>`;
  }

  function renderTopics() {
    return `
    <div class="page-wide">
      <div class="page-header reveal">
        <div class="page-kicker">跨嘉宾聚合 · 十大主线</div>
        <h1>全天十大主题地图</h1>
        <p class="page-desc">把白昼 18 场演讲的零散知识点打通串联，按十大主题直接回溯相关嘉宾与实证。</p>
      </div>
      <div class="talk-grid reveal reveal-d1">
        ${synthesis.topics
          .map((tp, idx) => {
            const talkCount = Array.from(TALK_MAP.values()).filter((tk) => (tk.tags || []).includes(tp.id)).length;
            return `
            <a class="card card-link" href="#/topic/${esc(tp.id)}">
              <div class="talk-card-top">
                <span class="five-num" style="margin:0;font-size:1.1rem">${String(idx + 1).padStart(2, '0')}</span>
                <span class="tag">${talkCount} 位相关嘉宾</span>
              </div>
              <h2 style="font-family:var(--font-serif);font-size:1.18rem;margin:0.4rem 0 0.25rem">${esc(tp.title)}</h2>
              <p class="talk-org">${esc(tp.subtitle)}</p>
              <p class="talk-oneliner" style="color:var(--muted)">${esc(tp.summary.slice(0, 88))}…</p>
            </a>`;
          })
          .join('')}
      </div>
    </div>`;
  }

  function renderTopicDetail(topicId) {
    const tp = TOPIC_MAP.get(topicId);
    if (!tp) return renderTopics();
    const relatedTalks = Array.from(TALK_MAP.values()).filter((tk) => (tk.tags || []).includes(topicId));

    return `
    <div class="page-narrow">
      <div style="margin-bottom:0.85rem;font-size:0.85rem;color:var(--muted)">
        <a href="#/topics">← 返回十大主题地图</a>
      </div>
      <div class="page-header reveal">
        <div class="page-kicker">主题深度聚合</div>
        <h1>${esc(tp.title)}</h1>
        <p class="page-desc">${esc(tp.subtitle)}</p>
      </div>

      <div class="oneliner-box reveal reveal-d1" style="font-family:var(--font-sans);font-size:0.98rem">
        ${esc(tp.summary)}
      </div>

      <section class="reveal reveal-d2">
        <div class="section-head"><h2>跨嘉宾核心论断（${(tp.points || []).length}）</h2></div>
        <ol class="kp-list">
          ${(tp.points || [])
            .map(
              (pt, idx) => `
            <li class="kp-item">
              <span class="kp-idx">${String(idx + 1).padStart(2, '0')}</span>
              <div class="kp-body">
                <div>${esc(pt.text)}</div>
                <div class="tag-row" style="margin-top:0.45rem">
                  ${(pt.refs || [])
                    .map((refId) => {
                      const tk = TALK_MAP.get(refId);
                      return tk
                        ? `<a class="tag tag-accent" href="#/talk/${esc(refId)}">${esc(tk.speaker)} · ${esc(tk.sessionTitle)} →</a>`
                        : '';
                    })
                    .join('')}
                </div>
              </div>
            </li>`
            )
            .join('')}
        </ol>
      </section>

      <section class="reveal reveal-d3">
        <div class="section-head"><h2>本主题关联嘉宾（${relatedTalks.length}）</h2></div>
        <div class="talk-grid">
          ${relatedTalks
            .map(
              (t) => `
            <a class="card card-link" href="#/talk/${esc(t.id)}">
              <div class="talk-card-top">
                <span class="talk-speaker">${esc(t.speaker)}</span>
                ${kindBadge(t.kind)}
              </div>
              <div class="talk-org">${esc(t.org)} · ${esc(t.sessionTitle)}</div>
              <p class="talk-oneliner">${esc(t.oneLiner)}</p>
            </a>`
            )
            .join('')}
        </div>
      </section>
    </div>`;
  }

  function renderMethods() {
    return `
    <div class="page-wide">
      <div class="page-header reveal">
        <div class="page-kicker">实操步骤横向并排对比</div>
        <h1>七套 GEO 实战方法论对照</h1>
        <p class="page-desc">桌面端可横向滚动对比七位一线操盘手的交付步骤与侧重点，移动端自动纵向堆叠。</p>
      </div>
      <div class="methods-board reveal reveal-d1">
        ${synthesis.methods
          .map(
            (m) => `
          <article class="method-col">
            <div>
              <div class="tag-row" style="margin-top:0;margin-bottom:0.45rem">
                <span class="tag tag-accent">${esc(m.speaker)}</span>
                <span class="tag">${esc(m.org)}</span>
              </div>
              <h2 style="font-family:var(--font-serif);font-size:1.15rem;margin:0 0 0.3rem">${esc(m.name)}</h2>
              <p style="font-size:0.84rem;color:var(--muted);margin:0 0 0.65rem">侧重：${esc(m.focus)}</p>
              <ol class="method-steps">
                ${(m.steps || []).map((st) => `<li><span>${esc(st)}</span></li>`).join('')}
              </ol>
            </div>
            <div style="margin-top:1rem;padding-top:0.65rem;border-top:1px dashed var(--rule)">
              <a class="tag" href="#/talk/${esc(m.talkId)}">查看完整演讲与原声 →</a>
            </div>
          </article>`
          )
          .join('')}
      </div>
    </div>`;
  }

  function renderDebates() {
    return `
    <div class="page-wide">
      <div class="page-header reveal">
        <div class="page-kicker">最具价值的思维碰撞</div>
        <h1>六大核心观点分歧</h1>
        <p class="page-desc">同样深耕一线的嘉宾为什么给出截然相反的建议？对照双方论据与业务前提，避开断章取义。<span class="ts-perm-note">点击 ▶ 时间戳可核对原声（需飞书权限）</span></p>
      </div>
      ${synthesis.debates
        .map(
          (db) => `
        <article class="debate-card reveal">
          <h2 class="debate-title">${esc(db.title)}</h2>
          <p class="debate-ctx">${esc(db.context)}</p>
          <div class="debate-sides">
            <div class="debate-col debate-col-a">
              <div class="debate-col-label">${esc(db.sideALabel)}</div>
              ${db.sideA
                .map(
                  (item) => `
                <div class="debate-claim">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem;margin-bottom:0.25rem">
                    <a href="#/talk/${esc(item.talkId)}" style="font-weight:700">${esc(item.speaker)} →</a>
                    ${talkTsAnchor(item.talkId, item.ts, false)}
                  </div>
                  <div>${esc(item.claim)}</div>
                </div>`
                )
                .join('')}
            </div>
            <div class="debate-col debate-col-b">
              <div class="debate-col-label" style="color:var(--accent)">${esc(db.sideBLabel)}</div>
              ${db.sideB
                .map(
                  (item) => `
                <div class="debate-claim">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem;margin-bottom:0.25rem">
                    <a href="#/talk/${esc(item.talkId)}" style="font-weight:700">${esc(item.speaker)} →</a>
                    ${talkTsAnchor(item.talkId, item.ts, false)}
                  </div>
                  <div>${esc(item.claim)}</div>
                </div>`
                )
                .join('')}
            </div>
          </div>
          <div class="debate-synthesis"><strong>复盘边界结论：</strong>${esc(db.synthesis)}</div>
        </article>`
        )
        .join('')}
    </div>`;
  }

  function renderQuotes() {
    return `
    <div class="page-wide">
      <div class="page-header reveal">
        <div class="page-kicker">逐字稿原话精选 · 点击即复制</div>
        <h1>大会金句卡片墙（${synthesis.quotes.length}）</h1>
        <p class="page-desc">所有原话均核对自逐字稿（仅清理口头语气词），点击任意卡片即可复制为「“原话” —— 嘉宾」分享给同学。<span class="ts-perm-note">▶ 时间戳需飞书权限</span></p>
      </div>
      <div class="quotes-masonry reveal reveal-d1">
        ${synthesis.quotes
          .map(
            (q) => `
          <article class="quote-card copyable-quote" data-quote="${esc(q.text)}" data-speaker="${esc(q.speaker)}">
            <span class="quote-mark">“</span>
            <p class="quote-text">${esc(q.text)}</p>
            <p style="font-size:0.82rem;color:var(--muted);margin:0 0 0.55rem">${esc(q.note)}</p>
            <div class="quote-foot">
              <a href="#/talk/${esc(q.talkId)}" onclick="event.stopPropagation()"><strong>${esc(q.speaker)}</strong> · ${esc(q.org)}</a>
              <span onclick="event.stopPropagation()">${talkTsAnchor(q.talkId, q.ts, false)}</span>
            </div>
          </article>`
          )
          .join('')}
      </div>
    </div>`;
  }

  function stepHref(st) {
    if (st.talkId) return `#/talk/${st.talkId}`;
    if (st.topicId) return `#/topic/${st.topicId}`;
    return st.route || '#/';
  }

  function renderPaths() {
    const checks = loadState('paths', {});
    return `
    <div class="page-narrow">
      <div class="page-header reveal">
        <div class="page-kicker">按角色定制复盘路线 · 进度自动保存在本地</div>
        <h1>三条学习路径</h1>
        <p class="page-desc">根据你是未到会同学、服务商操盘手还是品牌方决策人，勾选学习每一步并直达对应讲者与专题。</p>
      </div>
      ${synthesis.paths
        .map((p) => {
          const doneCount = p.steps.filter((st) => checks[st.id]).length;
          const pct = Math.round((doneCount / p.steps.length) * 100);
          return `
          <section class="card reveal" style="margin-bottom:1.25rem;padding:0">
            <div style="padding:1rem 1.1rem;border-bottom:1px solid var(--rule);background:var(--paper-deep)">
              <div class="talk-card-top">
                <h2 style="font-family:var(--font-serif);font-size:1.22rem;margin:0">${esc(p.title)}</h2>
                <span class="tag tag-accent">${esc(p.duration)}</span>
              </div>
              <p style="font-size:0.84rem;color:var(--muted);margin:0.35rem 0 0.65rem">${esc(p.audience)} · ${esc(p.desc)}</p>
              <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
              <div class="talk-time" style="margin-top:0.35rem">已完成 ${doneCount} / ${p.steps.length} 步（${pct}%）</div>
            </div>
            <div>
              ${p.steps
                .map(
                  (st, idx) => `
                <div class="step-row${checks[st.id] ? ' done' : ''}">
                  <input type="checkbox" class="check-box path-check" data-step-id="${esc(st.id)}" ${checks[st.id] ? 'checked' : ''} aria-label="${esc(st.title)}">
                  <div style="flex:1;min-width:0">
                    <div class="talk-card-top">
                      <span class="step-title" style="font-weight:600;font-size:0.95rem">${idx + 1}. ${esc(st.title)}</span>
                      <span class="talk-time">${esc(st.minutes)} 分钟</span>
                    </div>
                    <p style="margin:0.25rem 0 0.45rem;font-size:0.86rem;color:var(--muted)">${esc(st.reason)}</p>
                    <a class="tag tag-accent" href="${esc(stepHref(st))}">去学习 →</a>
                  </div>
                </div>`
                )
                .join('')}
            </div>
          </section>`;
        })
        .join('')}
    </div>`;
  }

  function renderQuiz() {
    const state = loadState('quiz', { answers: {} });
    const answers = state.answers || {};
    const total = synthesis.quiz.length;
    const answeredCount = Object.keys(answers).length;
    let correctCount = 0;
    synthesis.quiz.forEach((q, idx) => {
      if (answers[idx] === q.answer) correctCount++;
    });

    return `
    <div class="page-narrow">
      <div class="page-header reveal">
        <div class="page-kicker">20 道单选题 · 即时判分与出处回溯</div>
        <h1>大会内容理解自测</h1>
        <p class="page-desc">检验是否真正吃透全天核心数据、爬虫与排毒机制及核心分歧，答题进度保存在本地。</p>
      </div>

      <div class="card reveal" style="position:sticky;top:3.9rem;z-index:20;margin-bottom:1.25rem;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.75rem;border-color:var(--ink)">
        <div>
          <div style="font-family:var(--font-mono);font-size:1.1rem;font-weight:700">
            得分：<span style="color:var(--accent)">${correctCount}</span> / ${total} 题
            <span style="font-size:0.85rem;color:var(--muted);font-weight:400">（已答 ${answeredCount} 题）</span>
          </div>
        </div>
        <button type="button" class="btn btn-outline" id="resetQuizBtn">重做全部题目</button>
      </div>

      <div>
        ${synthesis.quiz
          .map((item, idx) => {
            const chosen = answers[idx];
            const isAnswered = chosen !== undefined;
            const letters = ['A', 'B', 'C', 'D'];
            return `
            <article class="quiz-card">
              <div style="font-weight:700;font-size:0.98rem">
                <span style="font-family:var(--font-mono);color:var(--accent);margin-right:0.35rem">${String(idx + 1).padStart(2, '0')}.</span>
                ${esc(item.q)}
              </div>
              <div class="quiz-options">
                ${item.options
                  .map((opt, oi) => {
                    let cls = 'quiz-opt';
                    if (isAnswered) {
                      if (oi === item.answer) cls += ' is-right';
                      else if (oi === chosen) cls += ' is-wrong';
                    }
                    return `<button type="button" class="${cls}" data-q="${idx}" data-o="${oi}" ${isAnswered ? 'disabled' : ''}>
                      <span style="font-family:var(--font-mono);font-weight:700">${letters[oi]}.</span>
                      <span>${esc(opt)}</span>
                    </button>`;
                  })
                  .join('')}
              </div>
              ${
                isAnswered
                  ? `<div class="quiz-explain">
                      <div style="font-weight:700;margin-bottom:0.3rem;color:${chosen === item.answer ? 'var(--ok)' : 'var(--accent)'}">
                        ${chosen === item.answer ? '✓ 回答正确' : `✗ 回答有误（正确答案：${letters[item.answer]}）`}
                      </div>
                      <div>${esc(item.explain)}</div>
                      <div style="margin-top:0.5rem;display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center">
                        <a class="tag tag-accent" href="#/talk/${esc(item.refTalkId)}">查看出处详情 →</a>
                        ${talkTsAnchor(item.refTalkId, item.refTs, true)}
                      </div>
                    </div>`
                  : ''
              }
            </article>`;
          })
          .join('')}
      </div>
    </div>`;
  }

  function renderChecklist() {
    const checks = loadState('checklist', {});
    const list = synthesis.checklist;
    const done = list.filter((c) => checks[c.id]).length;
    const pct = Math.round((done / list.length) * 100);

    const groups = new Map();
    for (const item of list) {
      if (!groups.has(item.category)) groups.set(item.category, []);
      groups.get(item.category).push(item);
    }

    return `
    <div class="page-narrow">
      <div class="page-header reveal">
        <div class="page-kicker">15 项复盘行动条目 · 进度自动保存</div>
        <h1>GEO 落地行动清单</h1>
        <p class="page-desc">把整场大会的洞察转化为团队明天就能自查推进的具体动作。</p>
      </div>

      <div class="card reveal" style="margin-bottom:1.25rem">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.65rem;margin-bottom:0.65rem">
          <div style="font-family:var(--font-mono);font-weight:700">执行进度：${done} / ${list.length}（${pct}%）</div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <button type="button" class="btn btn-accent" id="copyChecklistBtn">复制清单为文本</button>
            <button type="button" class="btn btn-outline" id="resetChecklistBtn">清空勾选</button>
          </div>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>

      ${Array.from(groups.entries())
        .map(
          ([cat, items]) => `
        <section class="card reveal" style="margin-bottom:1rem;padding:0">
          <div style="padding:0.75rem 1rem;background:var(--paper-deep);border-bottom:1px solid var(--rule);font-family:var(--font-serif);font-weight:700;font-size:1.05rem">${esc(cat)}</div>
          <div>
            ${items
              .map(
                (it) => `
              <div class="step-row${checks[it.id] ? ' done' : ''}">
                <input type="checkbox" class="check-box ck-check" data-ck-id="${esc(it.id)}" ${checks[it.id] ? 'checked' : ''} aria-label="${esc(it.text)}">
                <div style="flex:1;min-width:0">
                  <div class="step-title" style="font-weight:600;font-size:0.94rem">${esc(it.text)}</div>
                  <p style="margin:0.25rem 0 0.35rem;font-size:0.85rem;color:var(--muted)">${esc(it.detail)}</p>
                  ${it.refTalkId ? `<a class="tag" href="#/talk/${esc(it.refTalkId)}">关联演讲 →</a>` : ''}
                </div>
              </div>`
              )
              .join('')}
          </div>
        </section>`
        )
        .join('')}
    </div>`;
  }

  function renderResources() {
    const groups = new Map();
    for (const r of synthesis.resources) {
      if (!groups.has(r.category)) groups.set(r.category, []);
      groups.get(r.category).push(r);
    }

    return `
    <div class="page-wide">
      <div class="page-header reveal">
        <div class="page-kicker">会后物料与生态合作</div>
        <h1>大会资料、源码与试用汇总（${synthesis.resources.length}）</h1>
        <p class="page-desc"><strong>提示：物料请在参会群获取</strong>，或根据具体条目联系对应机构现场工作人员对接（本站已按隐私规范隐藏个人手机号与微信号）。</p>
      </div>
      ${Array.from(groups.entries())
        .map(
          ([cat, items]) => `
        <section style="margin-bottom:1.4rem">
          <div class="section-head"><h2>${esc(cat)}</h2></div>
          <div class="talk-grid">
            ${items
              .map(
                (r) => `
              <article class="card">
                <div class="talk-card-top">
                  <strong>${esc(r.item)}</strong>
                </div>
                <div class="talk-org">提供方：${esc(r.provider)}</div>
                <p style="font-size:0.88rem;margin:0.4rem 0 0.65rem">${esc(r.how)}</p>
                ${r.talkId ? `<a class="tag tag-accent" href="#/talk/${esc(r.talkId)}">查看对应演讲 →</a>` : ''}
              </article>`
              )
              .join('')}
          </div>
        </section>`
        )
        .join('')}
    </div>`;
  }

  function renderGlossary() {
    const { asrCorrections, terms } = synthesis.glossary;
    return `
    <div class="page-wide">
      <div class="page-header reveal">
        <div class="page-kicker">读懂专业黑话与恢复语音错字</div>
        <h1>术语词典与 ASR 纠错对照表</h1>
        <p class="page-desc">飞书语音转写将大量专业词汇识为同音错字，本页完整记录原文误写与规范术语，供复盘及听原声时对照。</p>
      </div>

      <section class="reveal reveal-d1">
        <div class="section-head">
          <h2>语音识别（ASR）纠错对照表</h2>
          <span class="section-sub">正文中已全部统一规范</span>
        </div>
        <div class="table-wrap">
          <table class="asr-table">
            <thead>
              <tr>
                <th style="width:28%">纪要/逐字稿原误写</th>
                <th style="width:20%">规范写法</th>
                <th>说明与上下文</th>
              </tr>
            </thead>
            <tbody>
              ${asrCorrections
                .map(
                  (row) => `
                <tr>
                  <td><code style="font-family:var(--font-mono);color:var(--accent)">${esc(row.raw)}</code></td>
                  <td><strong>${esc(row.standard)}</strong></td>
                  <td>${esc(row.note)}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="reveal reveal-d2">
        <div class="section-head"><h2>高频核心术语（${terms.length}）</h2></div>
        <div class="talk-grid">
          ${terms
            .map(
              (tm) => `
            <article class="card">
              <div class="talk-card-top">
                <strong>${esc(tm.term)}</strong>
                <span class="tag">${esc(tm.category)}</span>
              </div>
              <p style="font-size:0.88rem;color:var(--muted);margin:0.45rem 0 0">${esc(tm.desc)}</p>
            </article>`
            )
            .join('')}
        </div>
      </section>
    </div>`;
  }

  // Router
  function route() {
    const hash = location.hash || '#/';
    const app = document.getElementById('app');
    let html = '';
    let pageTitle = '全景首页';

    if (hash === '#/' || hash === '#') {
      html = renderHome();
      pageTitle = '全景首页';
    } else if (hash === '#/sessions') {
      html = renderSessions();
      pageTitle = '四大场次与嘉宾';
    } else if (hash.startsWith('#/talk/')) {
      const id = decodeURIComponent(hash.slice('#/talk/'.length));
      const tk = TALK_MAP.get(id);
      html = renderTalkDetail(id);
      pageTitle = tk ? `${tk.speaker} · ${tk.title}` : '全景首页';
    } else if (hash === '#/topics') {
      html = renderTopics();
      pageTitle = '十大主题地图';
    } else if (hash.startsWith('#/topic/')) {
      const id = decodeURIComponent(hash.slice('#/topic/'.length));
      const tp = TOPIC_MAP.get(id);
      html = renderTopicDetail(id);
      pageTitle = tp ? tp.title : '十大主题地图';
    } else if (hash === '#/methods') {
      html = renderMethods();
      pageTitle = '七套方法论对照';
    } else if (hash === '#/debates') {
      html = renderDebates();
      pageTitle = '六大观点碰撞';
    } else if (hash === '#/quotes') {
      html = renderQuotes();
      pageTitle = '金句卡片墙';
    } else if (hash === '#/paths') {
      html = renderPaths();
      pageTitle = '三条学习路径';
    } else if (hash === '#/quiz') {
      html = renderQuiz();
      pageTitle = '20题自测';
    } else if (hash === '#/checklist') {
      html = renderChecklist();
      pageTitle = '15项行动清单';
    } else if (hash === '#/resources') {
      html = renderResources();
      pageTitle = '会后物料汇总';
    } else if (hash === '#/glossary') {
      html = renderGlossary();
      pageTitle = '术语与ASR纠错';
    } else {
      html = renderHome();
      pageTitle = '全景首页';
    }

    app.innerHTML = html;
    document.title = `${pageTitle} · 2026 GEO 大会复盘手记`;
    renderNav(hash);

    // Close mobile menu & search on navigation
    const drawer = document.getElementById('mobileDrawer');
    const toggle = document.getElementById('menuToggle');
    if (drawer) drawer.hidden = true;
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    const sr = document.getElementById('searchResults');
    if (sr) sr.hidden = true;

    window.scrollTo(0, 0);
  }

  // Event delegation for interactive components
  document.getElementById('app').addEventListener('click', (e) => {
    const toggleDataBtn = e.target.closest('#toggleAllDataBtn');
    if (toggleDataBtn) {
      const cur = loadState('homeShowAllData', false);
      saveState('homeShowAllData', !cur);
      route();
      return;
    }

    const quoteCard = e.target.closest('.copyable-quote');
    if (quoteCard && !e.target.closest('a')) {
      const text = quoteCard.getAttribute('data-quote');
      const speaker = quoteCard.getAttribute('data-speaker');
      copyText(`“${text}” —— ${speaker}`, '已复制');
      return;
    }

    const quizOpt = e.target.closest('.quiz-opt');
    if (quizOpt) {
      const qIdx = Number(quizOpt.getAttribute('data-q'));
      const oIdx = Number(quizOpt.getAttribute('data-o'));
      const state = loadState('quiz', { answers: {} });
      if (state.answers[qIdx] === undefined) {
        state.answers[qIdx] = oIdx;
        saveState('quiz', state);
        const scrollY = window.scrollY;
        document.getElementById('app').innerHTML = renderQuiz();
        window.scrollTo(0, scrollY);
      }
      return;
    }

    if (e.target.closest('#resetQuizBtn')) {
      saveState('quiz', { answers: {} });
      route();
      showToast('已重置自测题');
      return;
    }

    if (e.target.closest('#copyChecklistBtn')) {
      const checks = loadState('checklist', {});
      const text = synthesis.checklist
        .map((c) => `${checks[c.id] ? '[x]' : '[ ]'} [${c.category}] ${c.text}\n    说明：${c.detail}`)
        .join('\n');
      copyText(`# 2026 第二届 GEO 大会落地行动清单\n\n${text}`, '已复制 15 项行动清单');
      return;
    }

    if (e.target.closest('#resetChecklistBtn')) {
      saveState('checklist', {});
      route();
      showToast('已清空清单勾选');
    }
  });

  document.getElementById('app').addEventListener('change', (e) => {
    const pathCb = e.target.closest('.path-check');
    if (pathCb) {
      const id = pathCb.getAttribute('data-step-id');
      const checks = loadState('paths', {});
      checks[id] = pathCb.checked;
      saveState('paths', checks);
      const scrollY = window.scrollY;
      document.getElementById('app').innerHTML = renderPaths();
      window.scrollTo(0, scrollY);
      return;
    }

    const ckCb = e.target.closest('.ck-check');
    if (ckCb) {
      const id = ckCb.getAttribute('data-ck-id');
      const checks = loadState('checklist', {});
      checks[id] = ckCb.checked;
      saveState('checklist', checks);
      const scrollY = window.scrollY;
      document.getElementById('app').innerHTML = renderChecklist();
      window.scrollTo(0, scrollY);
    }
  });

  // Mobile menu toggle
  document.getElementById('menuToggle').addEventListener('click', () => {
    const drawer = document.getElementById('mobileDrawer');
    const toggle = document.getElementById('menuToggle');
    const open = drawer.hidden;
    drawer.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  });

  // Global search (200ms debounce)
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  let searchTimer = null;

  function runSearch(query) {
    const q = query.trim();
    if (!q) {
      searchResults.hidden = true;
      searchResults.innerHTML = '';
      return;
    }
    const lowerQ = q.toLowerCase();
    const hits = [];
    for (const entry of SEARCH_INDEX) {
      if (entry.lower.includes(lowerQ)) {
        hits.push(entry);
        if (hits.length >= 50) break;
      }
    }

    if (hits.length === 0) {
      searchResults.innerHTML = `<div class="search-summary"><span>未找到与 “${esc(q)}” 相关的内容</span><span>Esc 关闭</span></div>`;
      searchResults.hidden = false;
      return;
    }

    searchResults.innerHTML =
      `<div class="search-summary"><span>找到 ${hits.length}${hits.length === 50 ? '+' : ''} 条匹配（最多显示 50 条）</span><span>Esc 关闭</span></div>` +
      hits
        .map(
          (h) => `
        <a class="search-item" href="${esc(h.route)}">
          <div class="search-item-meta">
            <span class="search-kind">${esc(h.kind)}</span>
            <span>${esc(h.meta || '')}</span>
          </div>
          <div class="search-item-title">${highlightMatch(h.title, q)}</div>
          <div class="search-item-snippet">${highlightMatch(makeSnippet(h.text, q), q)}</div>
        </a>`
        )
        .join('');
    searchResults.hidden = false;
  }

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(searchInput.value), 200);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) runSearch(searchInput.value);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchResults.hidden = true;
      searchInput.blur();
    } else if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      searchInput.focus();
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#searchWrap')) {
      searchResults.hidden = true;
    }
  });

  // Footer meta
  const footerMeta = document.getElementById('footerMeta');
  if (footerMeta && generatedAt) {
    const dt = new Date(generatedAt);
    const formatted = Number.isNaN(dt.getTime()) ? generatedAt : dt.toLocaleString('zh-CN', { hour12: false });
    footerMeta.textContent = `数据生成时间：${formatted} · 覆盖 ${sessions.length} 场次 · ${TALK_MAP.size} 讲者单元`;
  }

  window.addEventListener('hashchange', route);
  route();
})();
