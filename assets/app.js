(function () {
  'use strict';

  const DATA = window.GEO_DATA;
  if (!DATA) {
    document.getElementById('app').innerHTML =
      '<div class="card"><h1>数据加载失败</h1><p>请确认 assets/data.js 已生成。</p></div>';
    return;
  }

  const {
    sessions,
    synthesis,
    media = [],
    agenda = { slots: [] },
    photos = { items: [] },
    ppt = { items: {}, practice: [] },
    day2 = null,
    generatedAt,
  } = DATA;
  const photoItems = photos.items || [];

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
        day: s.day || 1,
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

  function cutText(str, max) {
    const s = String(str || '').trim();
    return s.length > max ? s.slice(0, max) + '…' : s;
  }

  function kpShortLabel(text) {
    const s = String(text || '').trim();
    const colonIdx = s.search(/[：:]/);
    if (colonIdx > 0 && colonIdx <= 26) {
      return s.slice(0, colonIdx);
    }
    return cutText(s, 22);
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

  function splitClauses(text, seps) {
    const out = [];
    const openChars = '“「『（(《【';
    const closeChars = '”」』）)》】';
    let depth = 0;
    let buf = '';
    for (const ch of String(text || '')) {
      if (openChars.includes(ch)) depth += 1;
      else if (closeChars.includes(ch)) depth = Math.max(0, depth - 1);
      if (depth === 0 && seps.includes(ch)) {
        if (ch !== '；') buf += ch;
        const trimmed = buf.trim();
        if (trimmed) out.push(trimmed);
        buf = '';
      } else {
        buf += ch;
      }
    }
    const tail = buf.trim();
    if (tail) out.push(tail);
    return out;
  }

  function highlightInline(escaped) {
    const withNums = escaped.replace(
      /(&#?\w+;)|((?<![A-Za-z0-9])\d[\d,.]*(?:\s*(?:%|万|亿|倍|次|家|人|年|个月|月|日|天|小时|分钟|秒|元|美元|篇|条|款|位|项|端口|平台|个|成))?)/g,
      (m, ent, num) => (ent ? ent : `<b class="nar-num">${num}</b>`)
    );
    return withNums.replace(/(“[^”]+”|「[^」]+」)/g, '<span class="nar-quote">$1</span>');
  }

  function formatNarrative(text) {
    const sentences = splitClauses(text, ['。', '！', '？']);
    if (!sentences.length) return '';
    const lead = sentences[0];
    const points = [];
    for (let i = 1; i < sentences.length; i++) {
      for (const piece of splitClauses(sentences[i], ['；'])) {
        points.push(piece);
      }
    }
    const conclusionRe = /^(据此|由此|因此|所以|最终|最后|综上|进而|为此)/;
    const pointsHtml = points.length
      ? `<ul class="nar-points">${points
          .map((p) => {
            const cls = conclusionRe.test(p) ? ' class="is-conclusion"' : '';
            return `<li${cls}>${highlightInline(esc(p))}</li>`;
          })
          .join('')}</ul>`
      : '';
    return `<p class="nar-lead">${highlightInline(esc(lead))}</p>${pointsHtml}`;
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

  // Lightbox
  const lightboxEl = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const lightboxStage = document.getElementById('lightboxStage');
  const lightboxZoomBtn = document.getElementById('lightboxZoomBtn');
  const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');

  function openLightbox(src, alt, caption) {
    if (!lightboxEl) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightboxImg.classList.remove('is-zoomed');
    lightboxCaption.textContent = caption ? `${alt} — ${caption}` : alt || '';
    lightboxEl.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightboxEl || lightboxEl.hidden) return;
    lightboxEl.hidden = true;
    lightboxImg.src = '';
    lightboxImg.classList.remove('is-zoomed');
    document.body.style.overflow = '';
  }

  if (lightboxZoomBtn) {
    lightboxZoomBtn.addEventListener('click', () => {
      lightboxImg.classList.toggle('is-zoomed');
    });
  }
  if (lightboxImg) {
    lightboxImg.addEventListener('click', (e) => {
      e.stopPropagation();
      lightboxImg.classList.toggle('is-zoomed');
    });
  }
  if (lightboxCloseBtn) {
    lightboxCloseBtn.addEventListener('click', closeLightbox);
  }
  if (lightboxStage) {
    lightboxStage.addEventListener('click', (e) => {
      if (e.target === lightboxStage) closeLightbox();
    });
  }

  // Navigation structure
  const NAV_GROUPS = [
    {
      label: '会议主干',
      items: [
        { route: '#/', label: '全景首页', badge: '总览' },
        { route: '#/sessions', label: '场次（两天）', badge: `${TALK_MAP.size}讲` },
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
        { route: '#/gallery', label: '图集', badge: `${media.length + photoItems.length}` },
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
      addIndex('嘉宾', `${t.speaker} · ${t.org}`, `${t.title} ${t.bio} ${t.oneLiner}`, route, t.agendaSlot || s.title);
      for (const nv of t.narrative || []) addIndex('论证脉络', `${t.speaker} · ${nv.heading}`, nv.text, route, nv.ts);
      for (const kp of t.keyPoints || []) addIndex('要点', `${t.speaker}：${t.title}`, kp.text, route, kp.ts);
      for (const m of t.methods || []) addIndex('方法', `${t.speaker} · ${m.name}`, (m.steps || []).join(' '), route, s.title);
      for (const d of t.data || []) addIndex('数据', `${t.speaker} · ${d.value}`, d.label, route, d.ts);
      for (const c of t.cases || []) addIndex('案例', `${t.speaker} · ${c.title}`, c.detail, route, c.ts);
      for (const q of t.quotes || []) addIndex('原话', `${t.speaker} 原声`, q.text, route, q.ts);
      for (const qa of t.qa || []) addIndex('问答', `${t.speaker} 问答`, `${qa.q} ${qa.a}`, route, qa.ts);
      for (const r of t.resources || []) addIndex('资源', `${t.speaker} · ${r.item}`, r.how, route, s.title);
      for (const u of t.uncertain || []) addIndex('核实备注', `${t.speaker} 核实备注`, u, route, s.title);
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
  for (const m of media) {
    addIndex('图集', m.title, m.caption, m.talkId ? `#/talk/${m.talkId}` : '#/gallery', m.kind === 'whiteboard' ? '总结导图' : 'AI配图');
  }
  for (const p of photoItems) {
    const tk = p.talkId ? TALK_MAP.get(p.talkId) : null;
    addIndex(
      '现场照',
      `${tk ? tk.speaker + ' · ' : ''}现场照片 (${p.takenAt || ''})`,
      `${p.caption || ''} ${p.slideText || ''}`,
      p.talkId ? `#/talk/${p.talkId}` : '#/gallery',
      `${p.sessionId || ''} · ${p.photographer || ''}`
    );
  }
  if (day2) {
    for (const th of day2.themes || []) {
      const firstRef = (th.refs || [])[0];
      addIndex('Day2主线', th.title, th.text, firstRef ? `#/talk/${firstRef}` : '#/sessions', 'Day 2');
    }
    for (const q of day2.quotes || []) {
      addIndex('Day2金句', `${q.speaker}（Day 2）`, q.text, q.talkId ? `#/talk/${q.talkId}` : '#/sessions', q.ts);
    }
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

  const PHOTO_KIND_LABEL = {
    speaker: '讲者特写',
    stage: '现场演讲',
    slide: '现场 PPT',
    panel: '圆桌现场',
    scene: '会场实景',
    audience: '台下观众',
  };

  function speakerPortrait(talkId) {
    return (
      photoItems.find((p) => p.talkId === talkId && p.kind === 'speaker') ||
      photoItems.find((p) => p.talkId === talkId && (p.kind === 'panel' || p.kind === 'stage')) ||
      photoItems.find((p) => p.talkId === talkId) ||
      null
    );
  }

  function renderPhotoCredit() {
    if (!photoItems.length) return '';
    const srcUrl = photos.source || 'https://www.xxpie.com/m/album?id=6afeda1730285548f60b41b5&source=SHARE_LINK&r=9951';
    const credit = photos.credit || '现场照片：享像派照片直播 · 摄影 文化致胜、刘宇琪';
    return `<p class="photo-credit">${esc(credit)} · <a href="${esc(srcUrl)}" target="_blank" rel="noopener">查看原始直播相册（含 Day1/Day2）↗</a></p>`;
  }

  function renderPhotoCard(p, showTalkLink = true) {
    const talk = p.talkId ? TALK_MAP.get(p.talkId) : null;
    const kindTag = PHOTO_KIND_LABEL[p.kind] || '现场照片';
    const fullCaption = `${p.caption || ''}（${p.takenAt || ''} · 摄影：${p.photographer || ''}）`;
    return `
      <figure class="card photo-card" style="margin:0">
        <div class="media-thumb-wrap is-photo">
          <img
            class="zoomable"
            src="${esc(p.thumb)}"
            data-full="${esc(p.file)}"
            alt="${esc(p.caption)}"
            data-caption="${esc(fullCaption)}"
            loading="lazy"
            decoding="async"
          >
          <span class="media-zoom-hint">点击大图</span>
        </div>
        <div class="photo-card-body">
          <div class="photo-card-meta">
            <div style="display:flex;gap:0.3rem;align-items:center;flex-wrap:wrap">
              <span class="tag ${p.kind === 'slide' ? 'tag-accent' : ''}">${esc(kindTag)}</span>
              ${p.takenAt ? `<span class="tag">${esc(p.takenAt)}</span>` : ''}
            </div>
            ${showTalkLink && talk ? `<a class="tag" href="#/talk/${esc(talk.id)}">${esc(talk.speaker)} →</a>` : ''}
          </div>
          <figcaption>${esc(p.caption)}</figcaption>
        </div>
        ${
          p.slideText
            ? `<div class="slide-text">
                <div class="slide-text-label">现场 PPT 要点</div>
                <div class="slide-text-body">${esc(p.slideText).replace(/\n/g, '<br>')}</div>
              </div>`
            : ''
        }
      </figure>`;
  }

  function renderMediaCard(m, isThumbSquare = true) {
    const talk = m.talkId ? TALK_MAP.get(m.talkId) : null;
    const kindTag = m.kind === 'whiteboard' ? '总结导图' : 'AI配图';
    return `
      <figure class="media-card" style="margin:0">
        <div class="media-thumb-wrap${isThumbSquare ? ' is-square' : ''}">
          <img
            class="zoomable"
            src="${esc(m.file)}"
            alt="${esc(m.title)}"
            data-caption="${esc(m.caption)}"
            loading="lazy"
          >
          <span class="media-zoom-hint">点击放大</span>
        </div>
        <div class="media-caption">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem">
            <span class="tag ${m.kind === 'whiteboard' ? 'tag-accent' : ''}">${esc(kindTag)}</span>
            ${talk ? `<a class="tag" href="#/talk/${esc(talk.id)}">${esc(talk.speaker)} →</a>` : ''}
          </div>
          <strong>${esc(m.title)}</strong>
          <figcaption>${esc(m.caption)}</figcaption>
        </div>
      </figure>`;
  }

  function renderPptSlot(t) {
    const entry = (ppt.items || {})[t.id] || { status: 'pending' };
    const slideCount = photoItems.filter((p) => p.talkId === t.id && p.kind === 'slide').length;
    const extraLinksHtml = (entry.extraLinks || []).length
      ? entry.extraLinks
          .map(
            (lk) =>
              `<a class="btn btn-outline" href="${esc(lk.url)}" target="_blank" rel="noopener noreferrer">${esc(lk.label)}</a>`
          )
          .join('')
      : '';

    if (entry.status === 'ready') {
      const hasPages = Array.isArray(entry.pages) && entry.pages.length > 0;
      return `
      <section class="reveal reveal-d2">
        <div class="section-head">
          <h2>PPT 课件</h2>
          <span class="section-sub">嘉宾已分享课件${hasPages ? ` · 共 ${entry.pages.length} 页` : ''}</span>
        </div>
        <div class="ppt-slot is-ready">
          <div class="ppt-slot-head">
            <span class="ppt-slot-icon" aria-hidden="true">📑</span>
            <div>
              <strong>${esc(entry.title || `${t.speaker} · 完整 PPT 课件`)}</strong>
              ${entry.note ? `<p class="ppt-slot-note">${esc(entry.note)}</p>` : ''}
            </div>
          </div>
          ${
            hasPages
              ? `<div class="ppt-grid">
                  ${entry.pages
                    .map(
                      (pg, idx) => `
                    <figure class="ppt-page-card">
                      <img class="zoomable" src="${esc(pg)}" data-full="${esc(pg)}" alt="${esc(t.speaker)} PPT 第 ${idx + 1} 页" loading="lazy" decoding="async">
                    </figure>`
                    )
                    .join('')}
                </div>`
              : ''
          }
          <div class="ppt-slot-actions">
            ${entry.url ? `<a class="btn btn-accent" href="${esc(entry.url)}" target="_blank" rel="noopener noreferrer">在线查看完整 PPT ↗</a>` : ''}
            ${entry.pdf ? `<a class="btn btn-outline" href="${esc(entry.pdf)}" target="_blank" rel="noopener noreferrer">下载完整 PDF ↗</a>` : ''}
            ${extraLinksHtml}
          </div>
        </div>
      </section>`;
    }

    return `
      <section class="reveal reveal-d2">
        <div class="section-head">
          <h2>PPT 课件</h2>
          <span class="section-sub">嘉宾授权后开放完整课件与 PDF 查阅</span>
        </div>
        <div class="ppt-slot">
          <div class="ppt-slot-head">
            <span class="ppt-slot-icon" aria-hidden="true">📎</span>
            <div>
              <strong>PPT 课件位 · 整理中（待嘉宾授权后上传）</strong>
              <p class="ppt-slot-note">${
                slideCount > 0
                  ? `本页已收录现场大屏实拍 ${slideCount} 张，见上方现场照片。`
                  : '完整现场实拍与导图请见上方图集。'
              }</p>
            </div>
          </div>
          <div class="ppt-slot-actions">
            <button type="button" class="btn btn-outline" data-scroll-contact>有课件？联系作者补充</button>
          </div>
        </div>
      </section>`;
  }

  // Page Renderers
  function renderHome() {
    const { overview, dataWall, paths } = synthesis;
    const fiveMinuteSummary = overview.fiveMinuteSummary || [];
    const pathChecks = loadState('paths', {});
    const showAllData = loadState('homeShowAllData', false);
    const wallItems = showAllData ? dataWall : dataWall.slice(0, 12);
    const sessionWhiteboards = media.filter((m) => m.kind === 'whiteboard' && !m.talkId);
    const groupPhoto =
      photoItems.find((p) => p.file.includes('scene-s2-02')) ||
      photoItems.find((p) => p.kind === 'scene' && /合影/.test(p.caption || ''));
    const panoramaPhoto =
      photoItems.find((p) => p.file.includes('scene-s1-03')) ||
      photoItems.find((p) => p.sessionId === 's1' && p.kind === 'scene' && /全景/.test(p.caption || ''));
    const heroPhotos = [groupPhoto, panoramaPhoto].filter(Boolean);
    const highlightPool = [];
    const seenPickIds = new Set();
    const tryPushHighlight = (p) => {
      if (p && !seenPickIds.has(p.id)) {
        seenPickIds.add(p.id);
        highlightPool.push(p);
      }
    };
    tryPushHighlight(photoItems.find((p) => p.file.includes('scene-s1-01')));
    tryPushHighlight(photoItems.find((p) => p.file.includes('scene-s2-01')));
    tryPushHighlight(photoItems.find((p) => p.file.includes('scene-s5-01')));
    tryPushHighlight(photoItems.find((p) => p.file.includes('scene-s7-prac-02')));
    for (const sid of sessions.map((s) => s.id)) {
      tryPushHighlight(
        photoItems.find((p) => p.sessionId === sid && (p.kind === 'panel' || p.kind === 'stage' || p.kind === 'speaker'))
      );
    }
    for (const p of photoItems) {
      if (highlightPool.length >= 8) break;
      tryPushHighlight(p);
    }
    const highlights = highlightPool.slice(0, 8);
    const totalTalks = sessions.reduce((sum, s) => sum + (s.talks || []).length, 0);
    const day1Sessions = sessions.filter((s) => (s.day || 1) === 1);
    const day2Sessions = sessions.filter((s) => s.day === 2);
    const day2Whiteboards = sessionWhiteboards.filter((m) => ['s5', 's6', 's7'].includes(m.sessionId));
    const day1Slots = (agenda.slots || []).filter((r) => (r.day || 1) === 1);
    const day2Slots = (agenda.slots || []).filter((r) => r.day === 2);

    const renderAgendaTable = (rows) => `
      <div class="table-wrap">
        <table class="agenda-table">
          <thead>
            <tr>
              <th>议程时段</th>
              <th>嘉宾</th>
              <th>官方身份</th>
              <th>官方分享题目</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row) => {
                const target = row.talkId ? `#/talk/${row.talkId}` : '#/sessions';
                return `
                <tr class="is-clickable" onclick="location.hash='${esc(target)}'">
                  <td class="agenda-slot">${esc(row.slot)}</td>
                  <td style="font-weight:700;white-space:nowrap"><a href="${esc(target)}">${esc(row.speaker)}</a></td>
                  <td style="color:var(--muted);font-size:0.84rem">${esc(row.org)}</td>
                  <td>
                    <a href="${esc(target)}" style="font-weight:500">${esc(row.title)}</a>
                    ${row.note ? `<div class="agenda-note">${esc(row.note)}</div>` : ''}
                  </td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>`;

    const renderSessionTimelineBlock = (s) => `
      <div class="session-block">
        <div class="session-banner">
          <span class="session-banner-title">${esc(s.title)} · ${esc(s.subtitle)}</span>
          <span class="session-banner-meta">${esc(s.time)} · ${(s.talks || []).length} 场</span>
        </div>
        <div class="talk-grid">
          ${(s.talks || [])
            .map((t) => {
              const av = speakerPortrait(t.id);
              const hasPpt = (ppt.items || {})[t.id]?.status === 'ready';
              return `
            <a class="card card-link" href="#/talk/${esc(t.id)}">
              <div class="talk-card-top">
                <span class="talk-speaker-wrap">
                  ${av ? `<img class="talk-avatar" src="${esc(av.thumb)}" alt="${esc(t.speaker)}" loading="lazy" decoding="async">` : ''}
                  <span class="talk-speaker">${esc(t.speaker)}</span>
                </span>
                <div style="display:flex;gap:0.25rem;align-items:center">
                  ${hasPpt ? '<span class="tag tag-ok">含PPT</span>' : ''}
                  ${kindBadge(t.kind)}
                </div>
              </div>
              <div class="talk-org">${esc(t.org)}</div>
              <div style="font-weight:600;font-size:0.9rem;margin:0.2rem 0">${esc(t.title)}</div>
              <p class="talk-oneliner" style="color:var(--muted)">${esc(t.oneLiner)}</p>
              <div class="talk-card-top">
                <span class="talk-time">议程 ${esc(t.agendaSlot || '')} · 录音 ${esc(t.start)}–${esc(t.end)}</span>
                ${t.nameConfidence !== 'high' ? '<span class="tag tag-warn">待核实</span>' : ''}
              </div>
            </a>`;
            })
            .join('')}
        </div>
      </div>`;

    return `
    <div class="page-wide">
      <header class="masthead reveal">
        <div class="masthead-kicker">
          <span>2026·11·21–22 · 深圳</span>
          <span>第二届中国 GEO 大会</span>
          <span>官网议程校准 · 逐字稿精读 · 飞书导图 · 现场实拍</span>
        </div>
        <h1>${esc(overview.title)}</h1>
        <p class="masthead-sub">${esc(overview.subtitle)} — ${esc(overview.positioning)}</p>

        <div class="facts-strip">
          <div class="fact-cell"><div class="fact-label">时间（两天全覆盖）</div><div class="fact-val">2026 年 11 月 21–22 日（Day 1 + Day 2）</div></div>
          <div class="fact-cell"><div class="fact-label">参会规模</div><div class="fact-val">${esc(overview.scale)}</div></div>
          <div class="fact-cell"><div class="fact-label">内容覆盖</div><div class="fact-val">共 ${sessions.length} 大场次 ${totalTalks} 讲（Day 1 18 讲 + Day 2 8 讲）· ${media.length} 张导图配图 · ${photoItems.length} 张实拍</div></div>
          <div class="fact-cell"><div class="fact-label">会前收集 &amp; 下一站</div><div class="fact-val">${esc(overview.preQuestionsCount)} · ${esc(overview.nextEdition)}</div></div>
        </div>

        <div class="tag-row">
          <span class="tag tag-accent">会前107问高频TOP</span>
          ${(overview.topConcerns || []).map((c) => `<span class="tag">${esc(c)}</span>`).join('')}
        </div>
        ${
          heroPhotos.length
            ? `<div class="home-hero-photo">
                ${heroPhotos
                  .map(
                    (hp) => `
                  <figure>
                    <div class="media-thumb-wrap is-photo">
                      <img
                        class="zoomable"
                        src="${esc(hp.thumb)}"
                        data-full="${esc(hp.file)}"
                        alt="${esc(hp.caption)}"
                        data-caption="${esc(hp.caption)}（${esc(hp.takenAt)} · 摄影：${esc(hp.photographer)}）"
                        loading="lazy"
                        decoding="async"
                      >
                      <span class="media-zoom-hint">点击大图</span>
                    </div>
                    <figcaption>${esc(hp.caption)}</figcaption>
                  </figure>`
                  )
                  .join('')}
              </div>`
            : ''
        }
      </header>

      <section class="reveal reveal-d1">
        <div class="section-head">
          <h2>5 分钟看懂 Day 1</h2>
          <span class="section-sub">先建立 Day 1 全景认知，再按路径深挖</span>
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

      ${
        day2
          ? `<section class="reveal reveal-d1" id="day2Section">
              <div class="section-head">
                <h2>Day 2 · 11月22日</h2>
                <a class="tag tag-accent" href="#/sessions">进入 Day 2 场次 →</a>
              </div>
              <div class="card d2-overview-card">
                <div class="talk-card-top">
                  <strong style="font-family:var(--font-serif);font-size:1.1rem">${esc(day2.overview.title)}</strong>
                  <span class="tag tag-accent">${esc(day2.overview.recorded)}</span>
                </div>
                <p style="margin:0.45rem 0 0.55rem;font-size:0.9rem;color:var(--muted)">${esc(day2.overview.date)} · ${esc(day2.overview.practice)}</p>
                ${
                  (day2.overview.notRecorded || []).length
                    ? `<ul class="d2-note-list">${day2.overview.notRecorded.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`
                    : ''
                }
              </div>

              <div class="d2-theme-grid">
                ${(day2.themes || [])
                  .map(
                    (th, idx) => `
                  <article class="card d2-theme-card">
                    <div class="five-num">${String(idx + 1).padStart(2, '0')}</div>
                    <h3>${esc(th.title)}</h3>
                    <p>${esc(th.text)}</p>
                    <div class="tag-row">
                      ${(th.refs || [])
                        .map((rid) => {
                          const tk = TALK_MAP.get(rid);
                          return tk ? `<a class="tag" href="#/talk/${esc(rid)}">${esc(tk.speaker)} →</a>` : '';
                        })
                        .join('')}
                    </div>
                  </article>`
                  )
                  .join('')}
              </div>

              ${
                day2Whiteboards.length
                  ? `<div class="wb-grid" style="margin-top:0.9rem">
                      ${day2Whiteboards.map((m) => renderMediaCard(m, true)).join('')}
                    </div>`
                  : ''
              }

              ${
                (ppt.practice || []).length
                  ? `<div style="margin-top:1rem">
                      <div class="day-heading">Day 2 下午两场 GEO 实操课（课件与录屏预留位）</div>
                      <div class="d2-practice-grid">
                        ${ppt.practice
                          .map(
                            (pr) => `
                          <div class="ppt-slot">
                            <div class="ppt-slot-head">
                              <span class="ppt-slot-icon" aria-hidden="true">🛠️</span>
                              <div>
                                <strong>${esc(pr.title)} · ${esc(pr.speaker)}</strong>
                                <p class="ppt-slot-note">原定 ${esc(pr.slot)} · ${esc(pr.note || '实操课未提供录音 · 课件/录屏位预留（现场实拍见下方图集）')}</p>
                              </div>
                            </div>
                            <div class="ppt-slot-actions">
                              ${(pr.extraLinks || [])
                                .map(
                                  (lk) =>
                                    `<a class="btn btn-outline" href="${esc(lk.url)}" target="_blank" rel="noopener noreferrer">${esc(lk.label)}</a>`
                                )
                                .join('')}
                              <button type="button" class="btn btn-outline" data-scroll-contact>补充实操课件/录屏</button>
                            </div>
                          </div>`
                          )
                          .join('')}
                      </div>
                    </div>`
                  : ''
              }
            </section>`
          : ''
      }

      <section class="reveal reveal-d2">
        <div class="section-head">
          <h2>${esc(agenda.title || '官方议程（两天总览）')}</h2>
          <a class="tag" href="${esc(agenda.source)}" target="_blank" rel="noopener">官网来源：hui.ailingdaoli.com ↗</a>
        </div>
        <div class="day-heading">Day 1 · 11月21日（周六）</div>
        ${renderAgendaTable(day1Slots)}
        <div class="day-heading" style="margin-top:1.25rem">Day 2 · 11月22日（周日）</div>
        ${renderAgendaTable(day2Slots)}
      </section>

      <section class="reveal reveal-d3">
        <div class="section-head">
          <h2>飞书 AI 总结导图（${sessionWhiteboards.length} 场总览）</h2>
          <a class="tag tag-accent" href="#/gallery">查看全部 ${media.length + photoItems.length} 张图集 →</a>
        </div>
        <div class="wb-grid">
          ${sessionWhiteboards.map((m) => renderMediaCard(m, true)).join('')}
        </div>
      </section>

      ${
        highlights.length
          ? `<section class="reveal reveal-d3">
              <div class="section-head">
                <h2>现场掠影（${highlights.length}/${photoItems.length}）</h2>
                <a class="tag tag-accent" href="#/gallery">浏览全部 ${photoItems.length} 张现场照片 →</a>
              </div>
              <div class="photo-grid">
                ${highlights.map((p) => renderPhotoCard(p, true)).join('')}
              </div>
              ${renderPhotoCredit()}
            </section>`
          : ''
      }

      <section class="reveal reveal-d3">
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

      <section class="reveal reveal-d4">
        <div class="section-head">
          <h2>两天时间轴 · ${sessions.length} 大场次 ${totalTalks} 场分享</h2>
          <a class="tag" href="#/sessions">查看场次导图与主持串场 →</a>
        </div>
        <div class="day-heading">Day 1 · 11月21日（周六）· ${day1Sessions.length} 场</div>
        ${day1Sessions.map(renderSessionTimelineBlock).join('')}
        ${
          day2Sessions.length
            ? `<div class="day-heading" style="margin-top:1.5rem">Day 2 · 11月22日（周日）· ${day2Sessions.length} 场</div>
               ${day2Sessions.map(renderSessionTimelineBlock).join('')}`
            : ''
        }
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
          <summary>嘉宾名单与资料核实说明（以官网议程 hui.ailingdaoli.com 为准）</summary>
          <ul>
            ${(overview.nameAuditNotice || []).map((line) => `<li>${esc(line)}</li>`).join('')}
          </ul>
        </details>
      </section>
    </div>`;
  }

  function renderSessions() {
    const totalTalks = sessions.reduce((sum, s) => sum + (s.talks || []).length, 0);
    const dayGroups = [
      { day: 1, label: 'Day 1 · 11月21日（周六）', list: sessions.filter((s) => (s.day || 1) === 1) },
      { day: 2, label: 'Day 2 · 11月22日（周日）', list: sessions.filter((s) => s.day === 2) },
    ].filter((g) => g.list.length > 0);

    const renderSessionCard = (s) => {
      const wb = media.find((m) => m.sessionId === s.id && m.kind === 'whiteboard' && !m.talkId);
      const cover =
        photoItems.find((p) => p.sessionId === s.id && p.kind === 'scene') ||
        photoItems.find((p) => p.sessionId === s.id && (p.kind === 'panel' || p.kind === 'stage' || p.kind === 'speaker'));
      return `
        <section class="session-block reveal" data-day="${s.day || 1}">
          <div class="session-banner">
            <span class="session-banner-title">${esc(s.title)} · ${esc(s.subtitle)}</span>
            <span class="session-banner-meta">${esc(s.date || '')} ${esc(s.time)} · 妙记 ${esc(s.miaojiId)}</span>
          </div>
          ${
            wb || cover
              ? `<div class="${wb && cover ? 'session-visual-row' : ''}" style="${!(wb && cover) ? 'margin-bottom:0.85rem' : ''}">
                  ${
                    wb
                      ? `<figure class="card" style="margin:0;padding:0.85rem">
                          <img
                            class="session-wb-img zoomable"
                            src="${esc(wb.file)}"
                            alt="${esc(wb.title)}"
                            data-caption="${esc(wb.caption)}"
                            loading="lazy"
                            decoding="async"
                          >
                          <figcaption style="margin-top:0.5rem;font-size:0.8rem;color:var(--muted);display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.4rem">
                            <span><strong>${esc(wb.title)}</strong> — ${esc(wb.caption)}</span>
                            <span class="tag">点击大图可缩放预览</span>
                          </figcaption>
                        </figure>`
                      : ''
                  }
                  ${
                    cover
                      ? `<figure class="card session-cover-card">
                          <div class="media-thumb-wrap is-photo">
                            <img
                              class="zoomable"
                              src="${esc(cover.thumb)}"
                              data-full="${esc(cover.file)}"
                              alt="${esc(cover.caption)}"
                              data-caption="${esc(cover.caption)}（${esc(cover.takenAt)} · 摄影：${esc(cover.photographer)}）"
                              loading="lazy"
                              decoding="async"
                            >
                            <span class="media-zoom-hint">点击高清大图</span>
                          </div>
                          <figcaption style="margin-top:0.55rem;font-size:0.8rem;color:var(--muted);line-height:1.45">
                            <span class="tag" style="margin-right:0.35rem">本场现场封面</span>${esc(cover.caption)}
                          </figcaption>
                        </figure>`
                      : ''
                  }
                </div>`
              : ''
          }
          ${
            (s.sessionNotes || []).length
              ? `<details class="editorial-details">
                  <summary>本场先导课、主持串场与现场花絮（${s.sessionNotes.length} 条）</summary>
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
              .map((t) => {
                const av = speakerPortrait(t.id);
                const hasPpt = (ppt.items || {})[t.id]?.status === 'ready';
                return `
              <article class="card card-link" onclick="location.hash='#/talk/${esc(t.id)}'" style="cursor:pointer">
                <div class="talk-card-top">
                  <span class="talk-speaker-wrap">
                    ${av ? `<img class="talk-avatar" src="${esc(av.thumb)}" alt="${esc(t.speaker)}" loading="lazy" decoding="async">` : ''}
                    <a class="talk-speaker" href="#/talk/${esc(t.id)}">${esc(t.speaker)}</a>
                  </span>
                  <div style="display:flex;gap:0.3rem;align-items:center">
                    ${hasPpt ? '<span class="tag tag-ok">含PPT</span>' : ''}
                    ${t.nameConfidence !== 'high' ? '<span class="tag tag-warn">待核实</span>' : ''}
                    ${kindBadge(t.kind)}
                  </div>
                </div>
                <div class="talk-org">${esc(t.org)}</div>
                <div class="talk-time" style="margin-bottom:0.35rem">议程 ${esc(t.agendaSlot || '')} · 录音 ${esc(t.start)}–${esc(t.end)}</div>
                <div style="font-weight:600;font-size:0.93rem;margin-bottom:0.3rem">${esc(t.title)}</div>
                <p class="talk-oneliner">${esc(t.oneLiner)}</p>
                <div class="tag-row" onclick="event.stopPropagation()">
                  ${(t.tags || []).map(tagBadge).join('')}
                </div>
              </article>`;
              })
              .join('')}
          </div>
        </section>`;
    };

    return `
    <div class="page-wide">
      <div class="page-header reveal">
        <div class="page-kicker">两天共 ${sessions.length} 大场次 · 飞书画板导图 + 嘉宾列表</div>
        <h1>场次与嘉宾目录</h1>
        <p class="page-desc">共收录两天 ${sessions.length} 场 ${totalTalks} 个讲者单元（Day 1 共 4 场 18 讲 + Day 2 共 3 场 8 讲）。每场提供飞书总结导图与现场封面（点击可放大），展开「串联与花絮」可查看先导课与现场议程变动。<span class="ts-perm-note">▶ 时间戳需飞书权限</span></p>
        <div class="day-filter" role="group" aria-label="按日期筛选场次">
          <button type="button" class="day-filter-btn is-active" data-day-filter="all">全部（${sessions.length} 场）</button>
          <button type="button" class="day-filter-btn" data-day-filter="1">Day 1 · 11/21（${dayGroups[0]?.list.length || 0} 场）</button>
          <button type="button" class="day-filter-btn" data-day-filter="2">Day 2 · 11/22（${dayGroups[1]?.list.length || 0} 场）</button>
        </div>
      </div>
      ${dayGroups
        .map(
          (g) => `
        <div class="day-group" data-day="${g.day}">
          <div class="day-heading">${esc(g.label)}</div>
          ${g.list.map(renderSessionCard).join('')}
        </div>`
        )
        .join('')}
    </div>`;
  }

  function renderMindmap(t) {
    const kps = (t.keyPoints || []).slice(0, 8);
    const methods = t.methods || [];
    const dataItems = t.data || [];
    const cases = t.cases || [];

    const branches = [];
    if (kps.length) {
      branches.push({
        label: '核心要点',
        html: kps
          .map(
            (kp, idx) =>
              `<li class="mm-leaf"><button type="button" class="mm-node-btn mm-jump" data-target="kp-${idx}">${String(idx + 1).padStart(2, '0')} · ${esc(kpShortLabel(kp.text))}</button></li>`
          )
          .join(''),
      });
    }
    if (methods.length) {
      branches.push({
        label: '方法论',
        html: methods
          .map(
            (m, idx) => `
            <li class="mm-leaf">
              <details>
                <summary class="mm-node-btn" style="display:inline-flex;align-items:center;gap:0.4rem;cursor:pointer;list-style:none">
                  <span>${esc(m.name)}</span>
                  <span style="font-family:var(--font-mono);font-size:0.72rem;color:var(--accent)">(${(m.steps || []).length}步 ▾)</span>
                </summary>
                <div class="mm-substeps">
                  ${(m.steps || []).map((st, si) => `<div>${si + 1}. ${esc(st)}</div>`).join('')}
                  <div style="margin-top:0.2rem"><button type="button" class="tag tag-accent mm-jump" data-target="method-${idx}" style="border-width:1px">定位到正文字段 ↓</button></div>
                </div>
              </details>
            </li>`
          )
          .join(''),
      });
    }
    if (dataItems.length) {
      branches.push({
        label: '关键数据',
        html: dataItems
          .map(
            (d, idx) =>
              `<li class="mm-leaf"><button type="button" class="mm-node-btn mm-jump" data-target="data-${idx}"><strong style="color:var(--accent)">${esc(d.value)}</strong> · ${esc(cutText(d.label, 16))}</button></li>`
          )
          .join(''),
      });
    }
    if (cases.length) {
      branches.push({
        label: '案例',
        html: cases
          .map(
            (c, idx) =>
              `<li class="mm-leaf"><button type="button" class="mm-node-btn mm-jump" data-target="case-${idx}">${esc(c.title)}</button></li>`
          )
          .join(''),
      });
    }

    if (!branches.length) return '';

    return `
      <section class="reveal reveal-d2">
        <div class="section-head">
          <h2>观点导图</h2>
          <span class="section-sub">点击节点跳转对应细节，方法论节点可展开步骤</span>
        </div>
        <div class="mindmap-wrap">
          <div class="mm-tree">
            <div class="mm-root">
              <small>${esc(t.speaker)} · ${esc(t.agendaSlot || '')}</small>
              ${esc(t.title)}
            </div>
            <div class="mm-branches">
              ${branches
                .map(
                  (b) => `
                <div class="mm-branch">
                  <div class="mm-branch-label">${esc(b.label)}</div>
                  <ul class="mm-leaves">${b.html}</ul>
                </div>`
                )
                .join('')}
            </div>
          </div>
        </div>
      </section>`;
  }

  function renderTalkDetail(talkId) {
    const t = TALK_MAP.get(talkId);
    if (!t) return renderHome();

    const sess = SESSION_MAP.get(t.sessionId);
    const prevTalk = t.indexInSession > 0 ? sess.talks[t.indexInSession - 1] : null;
    const nextTalk = t.indexInSession < sess.talks.length - 1 ? sess.talks[t.indexInSession + 1] : null;
    const talkMedia = media.filter((m) => m.talkId === t.id);
    const talkPhotos = photoItems.filter((p) => p.talkId === t.id);
    const portrait = speakerPortrait(t.id);

    return `
    <div class="page-narrow">
      <div style="margin-bottom:0.85rem;font-size:0.85rem;color:var(--muted)">
        <a href="#/sessions">← 返回场次目录</a> · ${esc(t.sessionTitle)}（${esc(sess.time)}）
      </div>

      <article class="talk-hero reveal">
        <div class="talk-card-top">
          <div style="display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center">
            ${kindBadge(t.kind)}
            ${t.agendaSlot ? `<span class="tag">议程 ${esc(t.agendaSlot)}</span>` : ''}
            ${t.nameConfidence !== 'high' ? '<span class="tag tag-warn">部分信息待核实</span>' : ''}
            ${tsAnchor(t.miaojiId, t.start, true)}
          </div>
          <span class="talk-time">录音 ${esc(t.start)} – ${esc(t.end)}</span>
        </div>
        <div class="talk-hero-head">
          ${
            portrait
              ? `<img
                  class="talk-portrait zoomable"
                  src="${esc(portrait.thumb)}"
                  data-full="${esc(portrait.file)}"
                  alt="${esc(t.speaker)}"
                  data-caption="${esc(portrait.caption || t.speaker)}（${esc(portrait.takenAt || '')} · 摄影：${esc(portrait.photographer || '')}）"
                  decoding="async"
                >`
              : ''
          }
          <div class="talk-hero-head-main">
            <h1 style="font-family:var(--font-serif);font-size:clamp(1.45rem,3.4vw,2.15rem);margin:0 0 0.35rem;line-height:1.25">${esc(t.title)}</h1>
            <div style="font-size:1rem;font-weight:700">${esc(t.speaker)} <span style="font-weight:400;color:var(--muted)">· ${esc(t.org)}</span></div>
            <p class="talk-bio">${esc(t.bio)}</p>
            <div class="tag-row">${(t.tags || []).map(tagBadge).join('')}</div>
          </div>
        </div>
      </article>

      <div class="oneliner-box reveal reveal-d1">
        <div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--accent);margin-bottom:0.25rem">一句话核心命题</div>
        ${esc(t.oneLiner)}
      </div>

      ${
        (t.narrative || []).length
          ? `<section class="reveal reveal-d1">
              <div class="section-head">
                <h2>论证脉络（${t.narrative.length} 段精读）</h2>
                <span class="section-sub">还原逐字稿起承转合与核心推演</span>
              </div>
              <div class="narrative-list">
                ${t.narrative
                  .map(
                    (nv, idx) => `
                  <article class="narrative-item">
                    <div class="narrative-head">
                      <div class="nar-title">
                        <span class="nar-idx">${String(idx + 1).padStart(2, '0')}</span>
                        <strong>${esc(nv.heading)}</strong>
                      </div>
                      ${tsAnchor(t.miaojiId, nv.ts, false)}
                    </div>
                    ${formatNarrative(nv.text)}
                  </article>`
                  )
                  .join('')}
              </div>
            </section>`
          : ''
      }

      ${renderMindmap(t)}

      ${
        talkMedia.length
          ? `<section class="reveal reveal-d2">
              <div class="section-head">
                <h2>图解（${talkMedia.length}）</h2>
                <span class="section-sub">来自飞书智能纪要配图/画板 · 点击可放大</span>
              </div>
              <div class="figure-grid">
                ${talkMedia.map((m) => renderMediaCard(m, false)).join('')}
              </div>
            </section>`
          : ''
      }

      ${
        talkPhotos.length
          ? `<section class="reveal reveal-d2">
              <div class="section-head">
                <h2>现场照片（${talkPhotos.length}）</h2>
                <span class="section-sub">现场直拍与大屏 PPT 逐字摘录 · 点击看高清大图</span>
              </div>
              <div class="photo-grid">
                ${talkPhotos.map((p) => renderPhotoCard(p, false)).join('')}
              </div>
              ${renderPhotoCredit()}
            </section>`
          : ''
      }

      ${renderPptSlot(t)}

      <section class="reveal reveal-d3">
        <div class="section-head">
          <h2>核心要点（${(t.keyPoints || []).length}）</h2>
          <span class="section-sub">点击 ▶ 时间戳跳原声（需飞书权限）</span>
        </div>
        <ol class="kp-list">
          ${(t.keyPoints || [])
            .map(
              (kp, idx) => `
            <li class="kp-item" id="kp-${idx}">
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
          ? `<section>
              <div class="section-head"><h2>方法论与操作步骤</h2></div>
              <div style="display:flex;flex-direction:column;gap:0.85rem">
                ${t.methods
                  .map(
                    (m, idx) => `
                  <div class="card" id="method-${idx}">
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
                    (d, idx) => `
                  <div class="data-card" id="data-${idx}">
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
                    (c, idx) => `
                  <div class="card" id="case-${idx}">
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
                    ${r.url ? `<div style="margin-top:0.45rem"><a class="tag tag-accent" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">打开链接 ↗</a></div>` : ''}
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

  function renderGallery() {
    const wbCount = media.filter((m) => m.kind === 'whiteboard').length;
    const figCount = media.filter((m) => m.kind === 'figure').length;
    const dayGroups = [
      { day: 1, label: 'Day 1 · 11月21日（周六）', list: sessions.filter((s) => (s.day || 1) === 1) },
      { day: 2, label: 'Day 2 · 11月22日（周日）', list: sessions.filter((s) => s.day === 2) },
    ].filter((g) => g.list.length > 0);

    return `
    <div class="page-wide">
      <div class="page-header reveal">
        <div class="page-kicker">可视化资产全览 · ${media.length} 张飞书导图/配图 + ${photoItems.length} 张现场直拍照片</div>
        <h1>导图与现场图集（${media.length + photoItems.length}）</h1>
        <p class="page-desc">上方汇总两天 ${sessions.length} 场飞书智能纪要生成的总结画板导图及关键图表（注：飞书 AI 原生图中个别音译误词如“绩优/GU”请结合站内文本对照）；下方收录精选两天大会现场照片与高清 PPT 大屏文字摘录。<span class="ts-perm-note">点击任意图片可打开高清大图缩放</span></p>
      </div>

      <section class="reveal">
        <div class="section-head">
          <h2>一、飞书总结导图与 AI 配图（${media.length}）</h2>
          <span class="section-sub">${wbCount} 张总结导图 + ${figCount} 张分主题图解</span>
        </div>
        ${dayGroups
          .map(
            (g) => `
          <div class="day-heading">${esc(g.label)}</div>
          ${g.list
            .map((s) => {
              const items = media.filter((m) => m.sessionId === s.id);
              if (!items.length) return '';
              return `
              <div class="session-block">
                <div class="session-banner">
                  <span class="session-banner-title">${esc(s.title)} · ${esc(s.subtitle)}</span>
                  <span class="session-banner-meta">${items.length} 张图表</span>
                </div>
                <div class="figure-grid">
                  ${items.map((m) => renderMediaCard(m, m.kind === 'whiteboard')).join('')}
                </div>
              </div>`;
            })
            .join('')}`
          )
          .join('')}
      </section>

      ${
        photoItems.length
          ? `<section class="reveal reveal-d1" style="margin-top:2rem">
              <div class="section-head">
                <h2>二、现场照片（${photoItems.length}）</h2>
                <span class="section-sub">按两天 ${sessions.length} 大场次归档 · 含讲者特写、PPT 大屏与全场实景</span>
              </div>
              ${renderPhotoCredit()}
              ${dayGroups
                .map(
                  (g) => `
                <div class="day-heading" style="margin-top:1.25rem">${esc(g.label)}</div>
                ${g.list
                  .map((s) => {
                    const sPhotos = photoItems.filter((p) => p.sessionId === s.id);
                    if (!sPhotos.length) return '';
                    return `
                    <div class="session-block" style="margin-top:1rem">
                      <div class="session-banner">
                        <span class="session-banner-title">${esc(s.title)} · 现场直拍</span>
                        <span class="session-banner-meta">${sPhotos.length} 张精选 · ${esc(s.time)}</span>
                      </div>
                      <div class="photo-grid">
                        ${sPhotos.map((p) => renderPhotoCard(p, true)).join('')}
                      </div>
                    </div>`;
                  })
                  .join('')}`
                )
                .join('')}
            </section>`
          : ''
      }
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
        <p class="page-desc">飞书语音转写将大量人名和专业词汇识为同音错字，本页完整记录原文误写与官网议程/规范术语，供复盘及听原声时对照。</p>
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
                <th style="width:30%">纪要/逐字稿原误写</th>
                <th style="width:24%">规范写法</th>
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
    } else if (hash === '#/gallery') {
      html = renderGallery();
      pageTitle = '导图与图解图集';
    } else {
      html = renderHome();
      pageTitle = '全景首页';
    }

    app.innerHTML = html;
    document.title = `${pageTitle} · 2026 GEO 大会复盘手记`;
    renderNav(hash);

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
    const zoomImg = e.target.closest('img.zoomable');
    if (zoomImg) {
      e.preventDefault();
      e.stopPropagation();
      openLightbox(
        zoomImg.getAttribute('data-full') || zoomImg.getAttribute('src'),
        zoomImg.getAttribute('alt'),
        zoomImg.getAttribute('data-caption')
      );
      return;
    }

    const mmJump = e.target.closest('.mm-jump');
    if (mmJump) {
      const targetId = mmJump.getAttribute('data-target');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetEl.style.outline = '2px solid var(--accent)';
        setTimeout(() => {
          targetEl.style.outline = '';
        }, 1400);
      }
      return;
    }

    const dayFilterBtn = e.target.closest('[data-day-filter]');
    if (dayFilterBtn) {
      const targetDay = dayFilterBtn.getAttribute('data-day-filter');
      document.querySelectorAll('.day-filter-btn').forEach((btn) => {
        btn.classList.toggle('is-active', btn === dayFilterBtn);
      });
      document.querySelectorAll('.day-group[data-day]').forEach((grp) => {
        grp.hidden = targetDay !== 'all' && grp.getAttribute('data-day') !== targetDay;
      });
      return;
    }

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
      if (lightboxEl && !lightboxEl.hidden) {
        closeLightbox();
        return;
      }
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

    const scrollBtn = e.target.closest('[data-scroll-contact]');
    if (scrollBtn) {
      e.preventDefault();
      document.getElementById('authorCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const wechatBtn = e.target.closest('.copy-wechat');
    if (wechatBtn) {
      e.preventDefault();
      const val = wechatBtn.getAttribute('data-copy-text') || 'siuserxiaowei';
      copyText(val, `已复制微信号：${val}`);
      return;
    }

    const qrImg = e.target.closest('img.wechat-qr');
    if (qrImg) {
      e.preventDefault();
      openLightbox(
        qrImg.getAttribute('src'),
        qrImg.getAttribute('alt') || '微信二维码',
        '微信号 siuserxiaowei · 微信扫码添加好友'
      );
    }
  });

  // Footer meta
  const footerMeta = document.getElementById('footerMeta');
  if (footerMeta && generatedAt) {
    const dt = new Date(generatedAt);
    const formatted = Number.isNaN(dt.getTime()) ? generatedAt : dt.toLocaleString('zh-CN', { hour12: false });
    footerMeta.textContent = `数据生成时间：${formatted} · 覆盖 ${sessions.length} 场次 · ${TALK_MAP.size} 讲者单元 · ${media.length} 张图解导图 · ${photoItems.length} 张现场照片`;
  }

  window.addEventListener('hashchange', route);
  route();
})();
