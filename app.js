// المصحف بالقراءات العشر — الموقع.
// البيانات: data/riwayat.json (سجل الروايات) و data/m/<مصحف>.json يُنزَّل عند اختيار الرواية ويُحفظ للاستخدام دون اتصال.
// لإضافة رواية: ضع ملف مصحفها في data/m/ واجعل status لها "ready" في السجل — لا تغيير في هذا الملف.
'use strict';
const $ = (id) => document.getElementById(id);
const ar = (n) => String(n).replace(/\d/g, (c) => '٠١٢٣٤٥٦٧٨٩'[c]);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MARK = /^[ۖ-ۜ۞۩]+$/u, QM = /^[ۖ-ۭ۞۩]+$/u;
const qd = (t) => { t = t.replace(/ے/g, 'ى').replace(/ٞ/g, 'ࣱ').replace(/ٗ(?=[\u06D6-\u06ED]*$)/g, 'ࣰ').replace(/ٖ(?=[\u06D6-\u06ED]*$)/g, 'ࣲ'); return (typeof SET !== 'undefined' && SET.openTan && SET.font !== 'sys') ? t : t.replace(/ࣰ/g, 'ً').replace(/ࣱ/g, 'ٌ').replace(/ࣲ/g, 'ٍ'); };
const ayn = (a) => '<span class="nb">' + ar(a) + '</span>';
const LS = { get(k, d) { try { const v = localStorage.getItem('q10.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('q10.' + k, JSON.stringify(v)); } catch (e) {} } };
// غيّر رقم الإصدار عند كل تحديث لبيانات المصاحف، فتُحذف النسخ المحفوظة القديمة وتُنزَّل الجديدة
const CACHE = 'q10-data-v40';
try { caches.keys().then((ks) => ks.forEach((k) => { if (k.startsWith('q10-data-') && k !== CACHE) caches.delete(k); })); } catch (e) {}

let skL = new Set(); let REG, B, M = null, RWV = null; // السجل، بيانات حفص، المصحف الحالي، الرواية الحالية
const RWS = new Map(); // id -> {q, ...}
const st = { page: LS.get('page', 1), mode: 'show', revealed: new Set(), marks: new Map(), last: null, showAll: false };
const isHidden = (key) => st.mode === 'mem' && !st.showAll && !st.revealed.has(key);
const pop = $('pop');

// ===== التنزيل والحفظ =====
async function getJSON(url) {
  // سجل الروايات يُجلب من الشبكة أولًا ليظهر كل مصحف جديد، وعند انقطاع الاتصال من المحفوظ
  if (url === 'data/riwayat.json') { try { const r = await fetch(url, { cache: 'no-cache' }); if (r.ok) { try { await (await caches.open(CACHE)).put(url, r.clone()); } catch (e) {} return r.json(); } } catch (e) {} }
  try { if ('caches' in window) { const c = await caches.open(CACHE); const hit = await c.match(url); if (hit) return hit.json(); } } catch (e) {}
  const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error(url + ' ' + r.status);
  try { if ('caches' in window) { const c = await caches.open(CACHE); await c.put(url, r.clone()); } } catch (e) {}
  return r.json();
}
async function isSaved(url) { try { return 'caches' in window && !!(await (await caches.open(CACHE)).match(url)); } catch (e) { return false; } }
const mushafCache = {};
async function loadMushaf(name) {
  if (name === 'base') return B;
  if (!mushafCache[name]) { toast('جارٍ تنزيل المصحف…', 0); mushafCache[name] = await getJSON('data/m/' + name + '.json'); hideToast(); }
  return mushafCache[name];
}

// ===== فهارس حفص =====
let ayahStart, ayahIdx, pageFirst;
function edPages() { // أول آية في كل صفحة بحسب الطبعة المختارة
  const P = B.lines && B.lines[SET.layout];
  pageFirst = P ? P.map((L) => ayahAtWord(lnStart(L))) : B.pageStarts.map(([s, a]) => ayahIdx.get(s + ':' + a));
}
function indexBase() {
  ayahStart = []; let w = 0;
  for (const [, , t] of B.ayahs) { ayahStart.push(w); for (const tk of t.split(' ')) if (!MARK.test(tk)) w++; }
  ayahIdx = new Map(B.ayahs.map((x, i) => [x[0] + ':' + x[1], i]));
  edPages();
}
const juzOf = (i) => { let j = 0; B.juzStarts.forEach(([s, a], k) => { if (ayahIdx.get(s + ':' + a) <= i) j = k; }); return j + 1; };
function pageOfAyah(i) { let p = 1; for (let k = 0; k < 604; k++) if (pageFirst[k] <= i) p = k + 1; return p; }

// ===== مصحف الرواية =====
let qStart = [], QCOL = new Set(), QSILA = new Set();
function indexM() { QCOL = new Set(M.col || []); QSILA = new Set(M.sila || []); qStart = []; let w = 0; for (const [, , t] of M.ayahs) { qStart.push(w); for (const tk of t.split(' ')) if (!QM.test(tk)) w++; } }
function qAyahAt(w) { let lo = 0, hi = qStart.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (qStart[m] <= w) lo = m; else hi = m - 1; } return lo; }
// علامة السكت: «س» حمراء صغيرة فوق موضعه — لام التعريف أول الكلمة، أو «شيء» وسطها، وإلا آخر الكلمة (ساكن قبل همز)
const skMark = (t) => '<i class="sk ' + (/^[وفبكل]?[ٱا]\S?ل[ْۡ]?[أإآءٔ]/u.test(t) ? 'skr' : /شَ?[ىي][ْۡ]?ء/u.test(t) ? 'skc' : 'skl') + '">س</i>';
// مواقف القراءة: لكل نوع (حفظ، مراجعة، تلاوة، تدبر) موقف واحد بلونه؛ الضغط على رقم الآية يختار النوع، وتُدار من «العلامات والملاحظات»
const SKINDS = [['hifz', 'حفظ', '#1f5fbf'], ['mur', 'مراجعة', '#c0392b'], ['til', 'تلاوة', '#1f7a5a'], ['tad', 'تدبر', '#8e44ad']];
let STOPS = LS.get('stops', {}); const SCOL = LS.get('stopColors', {});
{ const o = LS.get('stop', null); if (o && !Object.keys(STOPS).length) { STOPS.til = o; LS.set('stops', STOPS); } }
const sCol = (id) => SCOL[id] || SKINDS.find((x) => x[0] === id)[2];
const sName = (id) => SKINDS.find((x) => x[0] === id)[1];
const stopAt = (k) => Object.keys(STOPS).find((id) => STOPS[id] && STOPS[id].k === k && STOPS[id].rw === RWV.id);
const nSp = (s, a) => { const id = stopAt(s + ':' + a); return '<span class="n' + (id ? ' stp' : '') + '"' + (id ? ' style="background:' + sCol(id) + '"' : '') + ' data-stop="' + s + ':' + a + '">' + ayn(a) + '</span>'; };
const stopLabel = (x) => { const [s, a] = x.k.split(':').map(Number); return 'سورة ' + B.suras[s - 1].name + ' · الآية ' + ar(a) + ' · ' + esc((RWS.get(x.rw) || {}).n || ''); };
function goStop(id) { const x = STOPS[id]; if (!x) return; closeSheet(); hideToast(); st.page = x.p; if (x.rw !== RWV.id && RWS.get(x.rw)) openRw(x.rw); else go(x.p); }
// ===== الاستماع لحفص (العفاسي، ملف لكل آية من everyayah.com): شريط أسفل الصفحة — السورة، من آية إلى آية، عدد التكرار، تشغيل/إيقاف =====
const AUD = { a: new Audio(), k: null, s: 1, f: 1, t: 7, rep: 1, left: 0 };
const audUrl = (s, a) => 'https://everyayah.com/data/Alafasy_128kbps/' + String(s).padStart(3, '0') + String(a).padStart(3, '0') + '.mp3';
function audMark() { document.querySelectorAll('.n.play').forEach((e) => e.classList.remove('play')); if (AUD.k) { const e = document.querySelector('[data-stop="' + AUD.k + '"]'); if (e) e.classList.add('play'); } audUI(); }
function audOne(k) {
  const [s, a] = k.split(':').map(Number); AUD.k = k; AUD.a.src = audUrl(s, a);
  AUD.a.play().catch(() => { toast('تعذّر تشغيل الصوت'); audStop(); });
  const p = pageOfAyah(ayahIdx.get(k)); if (p && p !== st.page) go(p); else audMark();
}
// يبدأ من آية: إن كانت داخل المقطع المحدد يتابعه بتكراره، وإلا يقرأ من الآية إلى آخر السورة مرة واحدة
function audPlay(k) {
  const [s, a] = k.split(':').map(Number);
  if (!(s === AUD.s && a >= AUD.f && a <= AUD.t)) { AUD.s = s; AUD.f = a; AUD.t = B.suras[s - 1].ayahs; AUD.rep = 1; }
  AUD.left = AUD.rep === 0 ? Infinity : AUD.rep - 1; audOne(k);
}
function audStop() { AUD.a.pause(); AUD.k = null; audMark(); }
AUD.a.addEventListener('ended', () => {
  if (!AUD.k) return; const [s, a] = AUD.k.split(':').map(Number);
  if (a < AUD.t) return audOne(s + ':' + (a + 1));
  if (AUD.left > 0) { AUD.left--; return audOne(s + ':' + AUD.f); }
  audStop();
});
function audSync() { // يضبط الشريط على سورة الصفحة الحالية إذا لم يكن يعمل
  if (AUD.k || RWV.id !== 'hafs') return;
  const s = firstSura(st.page), i = pageFirst[st.page - 1], fa = B.ayahs[i] && B.ayahs[i][0] === s ? B.ayahs[i][1] : 1;
  if (s !== AUD.s) { AUD.s = s; AUD.f = fa; AUD.t = B.suras[s - 1].ayahs; }
}
function audUI() {
  const bar = $('aud'); if (!bar) return; bar.hidden = RWV.id !== 'hafs'; if (bar.hidden) return;
  const n = B.suras[AUD.s - 1].ayahs, opts = (v) => Array.from({ length: n }, (_, i) => '<option value="' + (i + 1) + '"' + (i + 1 === v ? ' selected' : '') + '>' + ar(i + 1) + '</option>').join('');
  if ($('aS').value != AUD.s) $('aS').value = AUD.s;
  $('aF').innerHTML = opts(AUD.f); $('aT').innerHTML = opts(AUD.t); $('aR').value = AUD.rep;
  $('aP').textContent = AUD.k ? '■' : '▶'; $('aP').setAttribute('aria-label', AUD.k ? 'إيقاف' : 'تشغيل'); bar.classList.toggle('on', !!AUD.k);
}
function audInit() {
  const bar = document.createElement('div'); bar.className = 'aud'; bar.id = 'aud';
  bar.innerHTML = '<button id="aP" class="ap" aria-label="تشغيل">▶</button>'
    + '<label><small>السورة</small><select id="aS">' + B.suras.map((x, i) => '<option value="' + (i + 1) + '">' + ar(i + 1) + ' ' + x.name + '</option>').join('') + '</select></label>'
    + '<label><small>من</small><select id="aF"></select></label><label><small>إلى</small><select id="aT"></select></label>'
    + '<label><small>التكرار</small><select id="aR">' + [1, 2, 3, 5, 7, 10, 20].map((v) => '<option value="' + v + '">' + ar(v) + '</option>').join('') + '<option value="0">∞</option></select></label>'
    + '<span class="aw"><small>القارئ</small>العفاسي · حفص</span>';
  $('bot').prepend(bar);
  $('aP').onclick = () => { if (AUD.k) return audStop(); AUD.left = AUD.rep === 0 ? Infinity : AUD.rep - 1; audOne(AUD.s + ':' + AUD.f); };
  $('aS').onchange = (e) => { audStop(); AUD.s = +e.target.value; AUD.f = 1; AUD.t = B.suras[AUD.s - 1].ayahs; audUI(); };
  $('aF').onchange = (e) => { AUD.f = +e.target.value; if (AUD.t < AUD.f) AUD.t = AUD.f; audUI(); };
  $('aT').onchange = (e) => { AUD.t = +e.target.value; if (AUD.f > AUD.t) AUD.f = AUD.t; audUI(); };
  $('aR').onchange = (e) => { AUD.rep = +e.target.value; if (AUD.k) AUD.left = AUD.rep === 0 ? Infinity : AUD.rep - 1; };
}
document.addEventListener('click', (e) => {
  const n = e.target.closest('[data-stop]'); if (!n || st.mode !== 'show') return;
  e.stopPropagation(); const k = n.dataset.stop; const [s, a] = k.split(':').map(Number); const cur = stopAt(k);
  let h = head('موقف عند سورة ' + B.suras[s - 1].name + ' · الآية ' + ar(a)) + (RWV.id === 'hafs' ? '<div class="grp"><h3>الاستماع (تجربة: مشاري العفاسي، رواية حفص)</h3><button class="opt" data-play="' + k + '"><span>▶ استمع من هذه الآية</span></button>' + (AUD.k ? '<button class="opt" data-play="stop"><span>■ إيقاف التلاوة</span></button>' : '') + '</div>' : '') + '<div class="grp"><h3>اختر نوع الموقف</h3>';
  for (const [id, nm] of SKINDS) h += '<button class="opt" data-setstop="' + id + '|' + k + '"><span><i class="sdot" style="background:' + sCol(id) + '"></i>' + nm + '</span><span class="mt">' + (STOPS[id] ? (cur === id ? 'هنا' : 'يُنقل إلى هنا') : '') + '</span></button>';
  if (cur) h += '<button class="opt" data-delstop="' + cur + '"><span>إزالة موقف «' + sName(cur) + '»</span></button>';
  sheetBack = null; openSheet(h + '</div>');
}, true);
$('sheet').addEventListener('click', (e) => {
  const t = e.target;
  const pl = t.closest('[data-play]'); if (pl) { closeSheet(); return pl.dataset.play === 'stop' ? audStop() : audPlay(pl.dataset.play); }
  const ss = t.closest('[data-setstop]'); if (ss) { const [id, k] = ss.dataset.setstop.split('|'); STOPS[id] = { k, rw: RWV.id, p: st.page, t: Date.now() }; LS.set('stops', STOPS); closeSheet(); toast('حُفظ موقف «' + sName(id) + '»'); return render(); }
  const ds = t.closest('[data-delstop]'); if (ds) { delete STOPS[ds.dataset.delstop]; LS.set('stops', STOPS); closeSheet(); toast('أُزيل الموقف'); return render(); }
  const gs = t.closest('[data-gostop]'); if (gs) return goStop(gs.dataset.gostop);
});
// حذف الموقف بسحبه إلى اليسار في قائمة المواقف
(() => { let row = null, x0 = 0, y0 = 0, dx = 0, lock = 0;
  const sh = $('sheet');
  sh.addEventListener('touchstart', (e) => { row = e.target.closest('[data-swdel]'); if (!row || e.target.closest('input,button')) { row = null; return; } x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; lock = 0; row.style.transition = 'none'; }, { passive: true });
  sh.addEventListener('touchmove', (e) => { if (!row) return; const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
    if (!lock) { if (Math.abs(mx) < 8 && Math.abs(my) < 8) return; lock = Math.abs(mx) > Math.abs(my) ? 1 : 2; }
    if (lock !== 1) return; e.preventDefault(); dx = Math.min(0, mx); row.style.transform = 'translateX(' + dx + 'px)'; }, { passive: false });
  sh.addEventListener('touchend', () => { if (!row) return; const r = row, id = r.dataset.swdel; row = null; r.style.transition = 'transform .2s';
    if (dx < -Math.min(110, r.offsetWidth * 0.35)) { r.style.transform = 'translateX(-110%)'; setTimeout(() => { delete STOPS[id]; LS.set('stops', STOPS); toast('حُذف موقف «' + sName(id) + '»'); render(); const g = r.closest('.grp'); if (g) g.outerHTML = stopsHTML(); }, 200); }
    else r.style.transform = ''; });
})();
$('sheet').addEventListener('input', (e) => { const id = e.target.dataset.scol; if (id) { SCOL[id] = e.target.value; LS.set('stopColors', SCOL); render(); } });
const stopsHTML = () => { let h = '<div class="grp"><h3>مواقف القراءة</h3><p class="note" style="padding:0 14px">اضغط رقم أي آية لحفظ موقف عندها. غيّر اللون من الدائرة. ولحذف موقف اسحبه إلى اليسار.</p>';
  for (const [id, nm] of SKINDS) { const x = STOPS[id];
    const row = '<div class="opt' + (x ? ' sw" data-swdel="' + id : '') + '"><span><input type="color" class="scol" data-scol="' + id + '" value="' + sCol(id) + '"> ' + nm + (x ? '<br><span class="mt">' + stopLabel(x) + '</span>' : '<br><span class="mt">لا موقف</span>') + '</span>' + (x ? '<button class="btn" data-gostop="' + id + '">انتقل</button>' : '') + '</div>';
    h += x ? '<div class="swr"><div class="swbg">حذف</div>' + row + '</div>' : row; }
  return h + '</div>'; };
const isFocus = (ids) => { const f = RWV.focus; return !f || ids.some((i) => f.some((n) => M.sites[i].r.includes(n))); };

function dots(tk, mm) {
  if (!mm || tk[mm[0]] !== mm[1]) return esc(tk);
  const i = mm[0]; let j = i + 1; while (j < tk.length && /[ً-ٰٟۖ-ۭ]/.test(tk[j])) j++;
  return esc(tk.slice(0, i)) + '<span class="dt' + (mm[2] & 1 ? ' i' : '') + (mm[2] & 2 ? ' t' : '') + '">' + esc(tk.slice(i, j)) + '</span>' + esc(tk.slice(j));
}
const hidSpan = (key, inner, num) => { const m = st.marks.get(key); return '<span class="hid' + (m === 'mistake' ? ' err' : m === 'hesitation' ? ' hes' : '') + '" data-k="' + key + '">' + inner + '</span>' + num; };

function pageHafs(p) {
  const from = pageFirst[p - 1], to = p < 604 ? pageFirst[p] : B.ayahs.length;
  let h = '<div class="hd"><span hidden>' + B.suras[B.ayahs[from][0] - 1].name + '</span><span class="rw">' + RWV.n + '</span><span>الجزء ' + ar(juzOf(from)) + '</span></div>';
  let txt = ''; const flush = () => { if (txt) { h += '<div class="tx">' + txt + '</div>'; txt = ''; } };
  for (let i = from; i < to; i++) {
    const [s, a, t] = B.ayahs[i]; const key = s + ':' + a; const toks = t.split(' '); let w = ayahStart[i];
    if (a === 1) { flush(); h += '<div class="sur">سُورَةُ ' + B.suras[s - 1].name + '</div>';
      if (s !== 1 && s !== 9) { let c = 0; const b = []; while (c < 4) { const tk = toks.shift(); if (!MARK.test(tk)) { c++; w++; } b.push(tk); } h += '<div class="bsm">' + esc(b.join(' ')) + '</div>'; }
      if (s === 1) { const b = toks.splice(0, 4); w += 4; h += '<div class="bsm">' + esc(b.join(' ')) + ' ' + nSp(1, 1) + '</div>'; if (!toks.length) continue; } }
    const num = ' ' + nSp(s, a) + ' ';
    if (isHidden(key)) { txt += hidSpan(key, esc(toks.join(' ')), num); continue; }
    const parts = [];
    for (const tk of toks) {
      if (MARK.test(tk)) { parts.push(esc(tk)); continue; }
      if (RWV.plain) { parts.push(esc(tk)); w++; continue; }
      const ss = B.wordSites[w], uu = B.wordUsul[w], mm = B.im[w], body = dots(tk, mm), tq = mm && mm[2] & 2 ? ' tq' : '';
      parts.push(ss ? '<span class="v' + (approvedAll(B, ss) ? ' ok' : '') + '" data-w="' + w + '" data-k="' + key + '">' + body + '</span>' : (uu || mm) ? '<span class="u' + tq + '" data-w="' + w + '" data-k="' + key + '">' + body + '</span>' : body); w++;
    }
    txt += parts.join(' ') + num;
  }
  flush();
  return h + '<div class="pnum">' + ar(p) + '</div>';
}

function pageM(p) {
  const from = M.pages[p - 1], to = p < 604 ? M.pages[p] : M.total, a0 = qAyahAt(from);
  let h = '<div class="hd"><span hidden>' + B.suras[M.ayahs[a0][0] - 1].name + '</span><span class="rw">' + RWV.n + '</span><span>الجزء ' + ar(B.juzByPage[p - 1]) + '</span></div>';
  let txt = ''; const flush = () => { if (txt) { h += '<div class="tx">' + txt + '</div>'; txt = ''; } };
  for (let i = a0; i < M.ayahs.length && qStart[i] < to; i++) {
    const [s, a, t] = M.ayahs[i]; const key = s + ':' + a; let w = qStart[i]; const toks = t.split(' ');
    let nw = 0; for (const tk of toks) if (!QM.test(tk)) nw++;
    const endsHere = qStart[i] + nw <= to;
    if (a === 1 && w >= from) { flush(); h += '<div class="sur">سُورَةُ ' + B.suras[s - 1].name + '</div>'; if (s !== 9 && M.bsm && !(s === 1 && M.fatihaBsm)) h += '<div class="bsm">' + esc(M.bsm) + '</div>'; }
    const hidden = isHidden(key), parts = [];
    // نص تنزيل يضم البسملة إلى أول آية من كل سورة، والبسملة معروضة في رأس السورة؛ فلا تُكرَّر
    let skipB = M.bsmInText && a === 1 && s !== 1 && s !== 9 ? 4 : 0;
    for (const tk of toks) {
      if (QM.test(tk)) { if (w >= from && w < to && !skipB) parts.push(esc(qd(tk))); continue; }
      if (skipB) { skipB--; w++; continue; }
      if (w < from || w >= to) { w++; continue; }
      const ss = M.ws[w];
      const mm = !hidden && RWV.id === 'qalun' && M.im ? M.im[w] : null;
      const body = dots(qd(QSILA.has(w) ? tk.replace(/مْ?([ۖ-ۜ]*)$/u, 'مُۥ$1') : tk), mm);
      const skW = (w, body) => (M.sk && M.sk[w] != null && !(RWV.id === 'khallad' && skL.has(w))) ? '<span class="skw">' + '<i class="sk' + (skL.has(w) ? ' skb' : '') + '" style="right:calc(' + M.sk[w] + '% - .25em)">س</i>' + body + '</span>' : body;
      parts.push(!hidden && ss ? '<span class="v' + (M.cls && M.cls[w] ? ' h' + M.cls[w] : '') + (isFocus(ss) ? '' : ' dim') + (approvedAll(M, ss) ? ' ok' : '') + '" data-q="1" data-w="' + w + '" data-k="' + key + '">' + (M.sk && M.sk[w] != null && !(RWV.id === 'khallad' && skL.has(w)) ? '<i class="sk' + (skL.has(w) ? ' skb' : '') + '" style="right:calc(' + M.sk[w] + '% - .25em)">س</i>' : '') + body + '</span>'
        : mm && mm[2] & 2 ? '<span class="tqc">' + body + '</span>' : !hidden && QCOL.has(w) ? '<span class="qr" data-k="' + key + '">' + body + '</span>' : skW(w, body));
      w++;
    }
    const num = endsHere ? ' ' + nSp(s, a) + ' ' : ' ';
    txt += hidden ? hidSpan(key, parts.join(' '), num) : parts.join(' ') + num;
    // الفاتحة: البسملة (الآية ١) سطر مستقل في الأعلى كما في المطبوع
    if (s === 1 && a === 1 && M.fatihaBsm) { h += '<div class="tx bsm1">' + txt + '</div>'; txt = ''; }
  }
  flush();
  if (p <= 2) { const k = h.indexOf('</div>') + 6; h = h.slice(0, k) + '<div class="open">' + h.slice(k) + '</div>'; }
  return h + '<div class="pnum">' + ar(p) + '</div>';
}

// ===== أسطر المطبوع (طبعة المجمع): كل سطر يبدأ وينتهي عند كلمته كما في المصحف =====
const lnStart = (L) => { const x = L.find((y) => typeof y[0] === 'number'); return x ? x[0] : null; };
function ayahAtWord(w) { let lo = 0, hi = ayahStart.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ayahStart[m] <= w) lo = m; else hi = m - 1; } return lo; }
function pageHafsLines(p, L) {
  // حدود الصفحة من أسطر الطبعة نفسها (قد تختلف بين الطبعتين)
  const P = B.lines[SET.layout], w0 = lnStart(L), w1 = p < 604 ? lnStart(P[p]) : 1e9;
  const from = ayahAtWord(w0), to = p < 604 ? ayahAtWord(w1 - 1) + 1 : B.ayahs.length;
  const words = {}; let lastW = 0; // رقم الكلمة -> html (الكلمة وعلاماتها ورقم الآية إن ختمت)
  for (let i = from; i < to; i++) {
    const [s, a, t] = B.ayahs[i]; const key = s + ':' + a; let w = ayahStart[i]; const toks = t.split(' ');
    const skip = a === 1 && s !== 1 && s !== 9 ? 4 : 0; let seen = 0; const hid = isHidden(key);
    let lastIdx = -1; toks.forEach((tk, j) => { if (!MARK.test(tk)) lastIdx = j; });
    toks.forEach((tk, j) => {
      if (MARK.test(tk)) { if (words[w - 1] !== undefined) words[w - 1] += ' ' + esc(tk); return; }
      if (seen++ < skip) { w++; return; }
      let h;
      if (RWV.plain || hid) h = esc(tk);
      else { const ss = B.wordSites[w], uu = B.wordUsul[w], mm = B.im[w], body = dots(tk, mm), tq = mm && mm[2] & 2 ? ' tq' : '';
        h = ss ? '<span class="v' + (approvedAll(B, ss) ? ' ok' : '') + '" data-w="' + w + '" data-k="' + key + '">' + body + '</span>' : (uu || mm) ? '<span class="u' + tq + '" data-w="' + w + '" data-k="' + key + '">' + body + '</span>' : body; }
      if (hid) h = '<span class="hid' + (st.marks.get(key) === 'mistake' ? ' err' : st.marks.get(key) === 'hesitation' ? ' hes' : '') + '" data-k="' + key + '">' + h + '</span>';
      if (j === lastIdx) h += ' ' + nSp(s, a);
      words[w] = h; lastW = w; w++;
    });
  }
  const starts = L.filter((x) => typeof x[0] === 'number').map((x) => x[0]);
  let h = '<div class="hd"><span hidden>' + B.suras[B.ayahs[from][0] - 1].name + '</span><span class="rw">' + RWV.n + '</span><span>الجزء ' + ar(juzOf(from)) + '</span></div><div class="lines">';
  let k = 0;
  for (const x of L) {
    if (x[0] === 's') { h += '<div class="sur">سُورَةُ ' + B.suras[x[1] - 1].name + '</div>'; continue; }
    if (x[0] === 'b') { h += '<div class="bsm">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</div>'; continue; }
    const a = starts[k], b = k + 1 < starts.length ? starts[k + 1] : Math.min(lastW + 1, w1); k++;
    const parts = []; for (let w = a; w < b; w++) if (words[w] !== undefined) parts.push(words[w]);
    h += '<div class="ln' + (x[1] ? ' c' : '') + '"><span class="lt">' + parts.join(' ') + '</span></div>';
  }
  return h + '</div><div class="pnum">' + ar(p) + '</div>';
}
// وزن الصفحة كالمطبوع: حجم واحد للخط يجعل أطول سطر يملأ عرض الصفحة، و١٥ سطرًا متساوية الارتفاع
function fitLines(root) {
  (root || document).querySelectorAll('.lines').forEach((box) => {
    const W = box.clientWidth; if (!W) return;
    box.style.setProperty('--fs', '30px'); box.classList.add('measure');
    let mx = 0; box.querySelectorAll('.ln:not(.c) .lt').forEach((t) => { mx = Math.max(mx, t.getBoundingClientRect().width); });
    if (!mx) box.querySelectorAll('.lt').forEach((t) => { mx = Math.max(mx, t.getBoundingClientRect().width); });
    box.classList.remove('measure');
    const fs = Math.max(12, Math.min(60, 30 * (W * 0.97) / (mx || W)));
    box.style.setProperty('--fs', fs.toFixed(2) + 'px');
  });
}
addEventListener('resize', () => fitLines());
if (document.fonts) { document.fonts.ready.then(() => fitLines()); document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => fitLines()); }
const pageHTML = (p) => (RWV.mushaf !== 'base' ? pageM(p) : !SET.big && SET.layout !== 'flow' && B.lines && B.lines[SET.layout] ? pageHafsLines(p, B.lines[SET.layout][p - 1]) : pageHafs(p));
function pageKeys() {
  const k = [];
  if (RWV.mushaf === 'base') { const from = pageFirst[st.page - 1], to = st.page < 604 ? pageFirst[st.page] : B.ayahs.length; for (let i = from; i < to; i++) k.push(B.ayahs[i][0] + ':' + B.ayahs[i][1]); }
  else { const from = M.pages[st.page - 1], to = st.page < 604 ? M.pages[st.page] : M.total; for (let i = qAyahAt(from); i < M.ayahs.length && qStart[i] < to; i++) k.push(M.ayahs[i][0] + ':' + M.ayahs[i][1]); }
  return k;
}
function firstSura(p) { return RWV.mushaf === 'base' ? B.ayahs[pageFirst[p - 1]][0] : M.ayahs[qAyahAt(M.pages[p - 1])][0]; }

// ===== العرض =====
function render() {
  closePop();
  if (st.mode === 'tj') return renderTj();
  $('pages').innerHTML = '<div class="pg"><div class="in" id="page">' + pageHTML(st.page) + '</div></div>'; fitLines();
  const s = firstSura(st.page);
  $('tSura').textContent = 'سورة ' + B.suras[s - 1].name; $('hSura').textContent = B.suras[s - 1].name + ' ▾';
  $('tSub').textContent = 'صفحة ' + ar(st.page) + ' · الجزء ' + ar(B.juzByPage[st.page - 1]);
  $('tRw').textContent = RWV.n;
  $('pnum').value = ar(st.page);
  const usul = RWV.plain ? '' : RWV.mushaf === 'base' ? (B.usul[st.page] ? '<button class="usb" id="usb">أصول الصفحة</button>' : '') : (M.usul && M.usul.length ? '<button class="usb" id="qusb">' + esc(M.usulTitle || 'تعريف المصحف') + '</button>' : '');
  const foot = RWV.plain ? 'النص: مشروع تنزيل tanzil.net (رواية حفص عن عاصم)' : RWV.mushaf === 'base' ? 'النص: مشروع تنزيل tanzil.net · الفرش: مصحف الراجح (الشاطبية والدرة)' : M.foot || '';
  $('below').innerHTML = usul + '<div class="ft"><span>' + esc(foot) + '</span><span class="dr">مسودة — تحتاج اعتماد المراجع</span></div>';
  LS.set('page', st.page); track(); markUI(); pushRecent(); decoratePage(); if (!$('aud')) audInit(); audSync(); audMark();
}
function go(p) { if (p < 1 || p > 604) return; st.page = p; st.last = null; st.revealed.clear(); render(); scrollTo(0, 0); }

// ===== التهجد: صفحات متصلة وتمرير تلقائي =====
const tj = { speed: LS.get('tjSpeed', 10), on: true, next: 1, raf: 0, acc: 0 };
function renderTj() {
  tj.next = st.page; $('pages').innerHTML = '';
  for (let i = 0; i < 3; i++) appendTj();
  $('tRw').textContent = RWV.n; tjUI(); tjLoop();
}
function appendTj() { if (tj.next > 604) return; const d = document.createElement('div'); d.className = 'pg'; d.dataset.p = tj.next; d.innerHTML = '<div class="in">' + pageHTML(tj.next) + '</div>'; $('pages').appendChild(d); fitLines(d); tj.next++; }
function tjLoop() {
  cancelAnimationFrame(tj.raf); let last = performance.now();
  const step = (now) => {
    if (st.mode !== 'tj') return;
    const dt = now - last; last = now;
    if (tj.on && !pop.classList.contains('show')) { tj.acc += dt * tj.speed * 0.0045; if (tj.acc >= 1) { const px = Math.floor(tj.acc); tj.acc -= px; scrollBy(0, px); } }
    if (innerHeight + scrollY > document.body.scrollHeight - 1500) appendTj();
    const pgs = [...document.querySelectorAll('#pages .pg')]; const cur = pgs.find((e) => e.getBoundingClientRect().bottom > 120);
    if (cur) { const p = +cur.dataset.p; if (p !== st.page) { st.page = p; LS.set('page', p); track(); const s = firstSura(p); $('tSura').textContent = 'سورة ' + B.suras[s - 1].name; $('hSura').textContent = B.suras[s - 1].name + ' ▾'; $('tSub').textContent = 'صفحة ' + ar(p) + ' · الجزء ' + ar(B.juzByPage[p - 1]); } }
    tj.raf = requestAnimationFrame(step);
  };
  tj.raf = requestAnimationFrame(step);
}
function tjUI() { $('tjSpd').textContent = ar(tj.speed); $('tjIco').innerHTML = tj.on ? '<rect x="6" y="5" width="4" height="14" rx="1" class="f"/><rect x="14" y="5" width="4" height="14" rx="1" class="f"/>' : '<path d="M8 5v14l11-7z" class="f"/>'; $('tjP').setAttribute('aria-label', tj.on ? 'إيقاف مؤقت' : 'تشغيل'); }
$('tjF').onclick = () => { tj.speed = Math.min(30, tj.speed + 1); LS.set('tjSpeed', tj.speed); tjUI(); };
$('tjS').onclick = () => { tj.speed = Math.max(1, tj.speed - 1); LS.set('tjSpeed', tj.speed); tjUI(); };
$('tjP').onclick = () => { tj.on = !tj.on; tjUI(); };
$('tjStop').onclick = () => setMode('show');
$('tjBg').onclick = cycleBg; $('bBg').onclick = cycleBg;

// ===== الأوضاع =====
function setMode(m) {
  st.mode = m; st.revealed.clear(); st.last = null; st.showAll = false; cancelAnimationFrame(tj.raf);
  document.body.classList.toggle('m-tj', m === 'tj'); document.body.classList.toggle('m-mem', m === 'mem');
  document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
  if (m === 'tj') tj.on = true; autoFlip();
  render(); if (m !== 'tj') scrollTo(0, 0);
}
$('modes').onclick = (e) => { const b = e.target.closest('button[data-m]'); if (b) setMode(b.dataset.m); };
function reveal(key) { st.revealed.add(key); st.last = key; render(); }
function mark(kind) { const k = st.last || pageKeys().find((x) => !st.revealed.has(x)); if (!k) return; st.marks.set(k, kind); toast((kind === 'mistake' ? 'سُجّل خطأ في الآية ' : 'سُجّل تردد في الآية ') + ar(k.split(':')[1])); }
$('revNext').onclick = () => { const k = pageKeys().find((x) => isHidden(x)); if (k) reveal(k); };
$('mkErr').onclick = () => mark('mistake'); $('mkHes').onclick = () => mark('hesitation');
$('revAll').onclick = () => { st.showAll = true; render(); };
$('hideAll').onclick = () => { st.showAll = false; st.revealed.clear(); st.last = null; render(); };

// ===== الرسائل =====
let toastT;
function toast(t, ms = 1600) { const e = $('toast'); e.textContent = t; e.classList.add('show'); clearTimeout(toastT); if (ms) toastT = setTimeout(hideToast, ms); }
function hideToast() { $('toast').classList.remove('show'); }

// ===== النوافذ السفلية =====
function openSheet(html) { closePop(); $('sheet').innerHTML = '<div class="grab"></div>' + html; $('sheet').classList.add('show'); $('scrim').classList.add('show'); $('sheet').scrollTop = 0; }
function closeSheet() { sheetBack = null; $('sheet').classList.remove('show'); $('scrim').classList.remove('show'); }
$('scrim').onclick = () => { closeSheet(); closePop(); };
let sheetBack = null;
const head = (t) => '<div class="sh">' + (sheetBack ? '<button class="x bk" data-back aria-label="رجوع"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>رجوع</button>' : '') + '<h2>' + t + '</h2><button class="x" data-close aria-label="إغلاق"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';

async function sheetRiwayat() {
  let h = head('اختر المصحف') + '<p class="note">يفتح التطبيق دائمًا على مصحف حفص. الروايات الأخرى ملوّنة بمواضع خلافها، وتُنزَّل مرة واحدة ثم تعمل دون اتصال.</p>';
  for (const r of REG.extra || []) h += '<button class="rbtn wide' + (r.id === RWV.id ? ' sel' : '') + '" data-rw="' + r.id + '">' + esc(r.title) + '<small>' + esc(r.desc || '') + '</small></button>';
  for (const q of REG.qurra) {
    h += '<div class="qrow"><b>' + esc(q.q) + '</b>';
    for (const r of q.r) {
      if (r.status !== 'ready') { h += '<button class="rbtn off" disabled>' + esc(r.n) + '<small>قريبًا</small></button>'; continue; }
      const saved = r.mushaf === 'base' || mushafCache[r.mushaf] || (await isSaved('data/m/' + r.mushaf + '.json'));
      h += '<button class="rbtn' + (r.id === RWV.id ? ' sel' : '') + '" data-rw="' + r.id + '">' + esc(r.n) + '<small>' + esc(r.tag || '') + '</small><span class="dl">' + (saved ? 'جاهزة دون اتصال' : 'تُنزَّل عند الفتح') + '</span></button>';
    }
    h += '</div>';
  }
  h += '<button class="opt" data-dlall><span>تنزيل كل الروايات الجاهزة للاستخدام دون اتصال</span><svg viewBox="0 0 24 24"><path d="M12 4v12M6 10l6 6 6-6M5 20h14"/></svg></button>';
  openSheet(h);
}
async function downloadAll() {
  const names = [...new Set([...RWS.values()].filter((r) => r.status === 'ready' && r.mushaf !== 'base').map((r) => r.mushaf))];
  let i = 0; for (const n of names) { toast('تنزيل ' + ar(++i) + ' من ' + ar(names.length) + '…', 0); try { mushafCache[n] = mushafCache[n] || (await getJSON('data/m/' + n + '.json')); } catch (e) {} }
  toast('اكتمل التنزيل ✓'); sheetRiwayat();
}
async function openRw(id) {
  const r = RWS.get(id); if (!r || r.status !== 'ready') return;
  try { const m = await loadMushaf(r.mushaf); RWV = r; if (r.mushaf !== 'base') { M = m; indexM(); skL = new Set(M.skB || []); } LS.set('rw', id); closeSheet(); st.revealed.clear(); render(); }
  catch (e) { hideToast(); toast('تعذّر تنزيل المصحف، تحقق من الاتصال'); }
}

const SET = { col: LS.get('col', true), big: LS.get('big', false), bg: LS.get('bg', 'green'), wake: LS.get('wake', true), layout: LS.get('layout', 'v2'), auto: false, autoSec: LS.get('autoSec', 60), edge: LS.get('edge', false), theme: LS.get('theme', 'manual'), tap: LS.get('tap', 'one') === 'long' ? 'one' : LS.get('tap', 'one'), qAlert: LS.get('qAlert', false), tips: LS.get('tips', true), openTan: LS.get('openTan2', true), font: LS.get('font', 'AM') === 'AQ' ? 'AM' : LS.get('font', 'AM') };
const BGS = [['green', '#eef4f7', 'أزرق فاتح'], ['white', '#ffffff', 'أبيض'], ['sand', '#fbf6ea', 'رملي'], ['night', '#141a1e', 'ليلي']];
function cycleBg() { const i = BGS.findIndex((b) => b[0] === SET.bg); SET.bg = BGS[(i + 1) % BGS.length][0]; LS.set('bg', SET.bg); applySet(); toast('الخلفية: ' + BGS.find((b) => b[0] === SET.bg)[2]); }
function applySet() { document.body.style.setProperty('--qf', SET.font === 'sys' ? "'Noto Naskh Arabic','Geeza Pro','Traditional Arabic',serif" : SET.font); document.body.classList.toggle('nocol', !SET.col); document.body.classList.toggle('big', SET.big); document.body.classList.remove('bg-white', 'bg-sand', 'bg-night'); if (SET.bg !== 'green') document.body.classList.add('bg-' + SET.bg); }
function sheetMenu() { sheetBack = null;
  const t = ACT[day()] || { r: [], m: [] };
  let h = head('القائمة') + '<div class="mh"><div><b>الورد اليوم</b><span>' + ar(t.r.length) + ' صفحة · الختمة ' + ar(Math.round(KH.length / 6.04)) + '٪</span></div><button data-act="prog">التقدم</button><button data-act="marks">العلامات ' + ar(Object.keys(MK.marks).length) + '</button><button data-act="marks">الملاحظات ' + ar(Object.keys(MK.notes).length) + '</button></div>';
  h += '<div class="grp"><h3>المصحف</h3>' +
    '<label class="opt">إظهار ألوان الخلاف<input type="checkbox" data-set="col"' + (SET.col ? ' checked' : '') + '></label>' +
    '<label class="opt">تكبير الخط (يلتف النص مع الشاشة)<input type="checkbox" data-set="big"' + (SET.big ? ' checked' : '') + '></label>' +
    '<div class="opt"><span>ترتيب الأسطر (مصحف حفص)</span><select data-layout>' + [['v1', 'طبعة المجمع ١٤٠٥'], ['v2', 'طبعة المجمع ١٤٢١'], ['flow', 'نص يلتف مع الشاشة']].filter(([k]) => k === 'flow' || (B.lines && B.lines[k])).map(([k, n]) => '<option value="' + k + '"' + (SET.layout === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
    '<div class="opt"><span>نوع الخط</span><select data-font>' + [['AM', 'أميري'], ['sys', 'خط الجهاز']].map(([k, n]) => '<option value="' + k + '"' + (SET.font === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
    '<div class="opt"><span>فتح نافذة الكلمة</span><select data-k="tap">' + [['one', 'نقرة واحدة'], ['off', 'إيقاف']].map(([k, n]) => '<option value="' + k + '"' + (SET.tap === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
    '<div class="opt"><span>المظهر</span><select data-k="theme">' + [['manual', 'حسب الخلفية'], ['auto', 'تلقائي (حسب الجوال)']].map(([k, n]) => '<option value="' + k + '"' + (SET.theme === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
    '<label class="opt">التنوين المتتابع كما في المطبوع (يحتاج خطًا يدعمه)<input type="checkbox" data-set="openTan"' + (SET.openTan ? ' checked' : '') + '></label>' +
    '<label class="opt">تنبيه عند بداية الحزب وأرباعه<input type="checkbox" data-set="qAlert"' + (SET.qAlert ? ' checked' : '') + '></label>' +
    '<label class="opt">نصيحة يومية<input type="checkbox" data-set="tips"' + (SET.tips ? ' checked' : '') + '></label>' +
    '<label class="opt">تقليب الصفحة بلمس حافتي الشاشة<input type="checkbox" data-set="edge"' + (SET.edge ? ' checked' : '') + '></label>' +
    '<div class="opt"><label style="display:flex;gap:8px;align-items:center">تقليب تلقائي<input type="checkbox" data-set="auto"' + (SET.auto ? ' checked' : '') + '></label><span>كل <select data-k="autoSec">' + [20, 30, 45, 60, 90, 120].map((n) => '<option value="' + n + '"' + (SET.autoSec == n ? ' selected' : '') + '>' + ar(n) + '</option>').join('') + '</select> ثانية</span></div>' +
    '<label class="opt">إبقاء الشاشة مضيئة<input type="checkbox" data-set="wake"' + (SET.wake ? ' checked' : '') + '></label>' +
    '<div class="opt"><span>لون الخلفية</span><span class="sw">' + BGS.map(([k, c, n]) => '<button aria-label="' + n + '" data-bg="' + k + '" class="' + (SET.bg === k ? 'on' : '') + '" style="background:' + c + '"></button>').join('') + '</span></div></div>';
  if (RWV.mushaf !== 'base' && M.legend) {
    const C = { m: '#c000c0', b: '#1747c9', r: '#e00000', c: '#00a3cc', g: '#1a9e1a', l: '#3366ff', o: '#e06400', y: '#7a9e00', n: '#c000c0' };
    h += '<div class="grp"><h3>مفتاح الألوان · ' + esc(RWV.n) + '</h3><div class="legend">' + Object.entries(M.legend).map(([k, t]) => '<span><i style="background:' + (C[k] || '#888') + '"></i>' + esc(t.split(':')[0]) + '</span>').join('') + '</div></div>';
  }
  h += '<div class="grp"><h3>التنقل</h3><button class="opt" data-act="rw">الروايات وتنزيلها</button><button class="opt" data-act="idx">الفهرس</button><button class="opt" data-act="search">البحث</button><button class="opt" data-act="marks">العلامات والملاحظات</button><button class="opt" data-act="prog">الحفظ والنشاط</button><button class="opt" data-act="tj">وضع التهجد</button><button class="opt" data-act="mem">التسميع</button><button class="opt" data-act="mushafs">المصاحف</button><button class="opt" data-act="about">عن المصحف</button><button class="opt" data-act="news">ما الجديد</button></div>';
  h += '<div class="grp"><h3>عن المصحف</h3><div class="opt" style="display:block;line-height:1.8;font-size:14px">' + esc(RWV.title) + ' — النص كما رُسم في مصدره دون تغيير، والألوان كما في مفتاحه. البيانات مسودة لم تعتمدها اللجنة العلمية بعد.<br><span class="mt">' + esc(RWV.plain ? 'النص: مشروع تنزيل' : RWV.mushaf === 'base' ? 'النص: مشروع تنزيل · الفرش: مصحف الراجح' : M.foot || '') + '</span></div></div>';
  openSheet(h);
}
$('sheet').addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('[data-close]')) return closeSheet();
  if (t.closest('[data-back]')) { const f = sheetBack; sheetBack = null; return f(); }
  const rw = t.closest('[data-rw]'); if (rw) return openRw(rw.dataset.rw);
  if (t.closest('[data-dlall]')) return downloadAll();
  if (t.closest('[data-mk]')) { const k = mkKey(); if (MK.marks[k]) delete MK.marks[k]; else MK.marks[k] = Date.now(); LS.set('marks', MK.marks); markUI(); return sheetMarks(); }
  if (t.closest('[data-ntsave]')) { const v = $('ntx').value.trim(), k = mkKey(); if (v) MK.notes[k] = v; else delete MK.notes[k]; LS.set('notes', MK.notes); toast('حُفظت الملاحظة'); return sheetMarks(); }
  const mg = t.closest('[data-mkgo]'); if (mg) { const [rw, p] = mg.dataset.mkgo.split(':'); closeSheet(); st.page = +p; if (rw !== RWV.id) return openRw(rw); return go(+p); }
  if (t.closest('[data-khreset]')) { KH = []; LS.set('khatma', KH); return sheetProgress(); }
  const tb = t.closest('[data-tab]'); if (tb) return sheetIndex(tb.dataset.tab);
  const rg = t.closest('[data-rwgo]'); if (rg && rg.dataset.rwgo !== RWV.id) { st.page = +rg.dataset.go; closeSheet(); return openRw(rg.dataset.rwgo); }
  const g = t.closest('[data-go]'); if (g) { closeSheet(); if (st.mode === 'tj') { st.page = +g.dataset.go; render(); scrollTo(0, 0); } else go(+g.dataset.go); return; }
  const bg = t.closest('[data-bg]'); if (bg) { SET.bg = bg.dataset.bg; LS.set('bg', SET.bg); applySet(); return sheetMenu(); }
  const a = t.closest('[data-act]'); if (a) { const k = a.dataset.act; if ($('sheet').querySelector('.mh')) sheetBack = sheetMenu; if (k === 'rw') return sheetRiwayat(); if (k === 'idx') return sheetIndex(); if (k === 'search') return sheetSearch(); if (k === 'marks') return sheetMarks(); if (k === 'prog') return sheetProgress(); if (k === 'about') return sheetAbout(); if (k === 'mushafs') return sheetMushafs(); if (k === 'news') return sheetNews(); closeSheet(); setMode(k); }
});
$('sheet').addEventListener('change', (e) => { const k = e.target.dataset.set; if (k) { SET[k] = e.target.checked; LS.set(k === 'openTan' ? 'openTan2' : k, SET[k]); applySet(); if (k === 'openTan') render(); if (k === 'auto') autoFlip(); if (k === 'big') render(); if (k === 'wake') { if (SET.wake) wake(); else if (wl) { wl.release(); wl = null; } } } });
$('bRw').onclick = sheetRiwayat; document.addEventListener('click', (e) => { if (e.target.closest('[data-hidx]')) sheetIndex(); else if (e.target.closest('[data-hsrch]')) sheetSearch(); }); $('bMenu').onclick = sheetMenu;
$('prev').onclick = () => go(st.page - 1); $('next').onclick = () => go(st.page + 1);
$('pnum').onchange = (e) => { const n = parseInt(e.target.value.replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c))); if (n) go(n); };

// ===== المراجعة العلمية (قاعدة بيانات الصفحة إن وُجدت) =====
const R = { db: null, user: null, can: false, rev: {}, state: 'off' };
const approvedAll = (D, ids) => ids.every((i) => (R.rev[D.sites[i].id] || {}).status === 'approved');
function reviewRow(id) {
  if (R.state === 'off') return '';
  const r = R.rev[id]; let h = '<div class="rv" data-id="' + esc(id) + '">';
  if (R.state === 'loading') h += '<span class="s">جارٍ تحميل حالة المراجعة…</span>';
  else if (R.state === 'slow') h += '<span class="s">تعذّر الوصول إلى بيانات المراجعة الآن</span>';
  else if (!r) h += '<span class="s">لم يُراجع</span>';
  else if (r.status === 'approved') h += '<span class="s ok">✓ معتمد</span>';
  else h += '<span class="s nt">ملاحظة: ' + esc(r.note || '') + '</span>';
  if (R.can && R.state === 'ready') { if (!r || r.status !== 'approved') h += '<button class="a" data-act="ok">اعتماد</button>'; h += '<button data-act="note">' + (r && r.status === 'note' ? 'تعديل الملاحظة' : 'ملاحظة') + '</button>'; if (r) h += '<button data-act="clear">إلغاء</button>'; }
  return h + '</div>';
}
async function writeReview(id, body) {
  const ref = R.db.collection('reviews').doc(id);
  try { if (body === null) await ref.delete(); else { body.by = (await R.user?.id?.()) || ''; body.at = new Date().toISOString(); await ref.set(body); } }
  catch (e) { if (e && e.code === 'invalid_argument') { R.can = false; toast('ليست لديك صلاحية المراجعة'); } else toast('تعذّر الحفظ، حاول مرة أخرى'); }
}
pop.addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-act]'); if (!b) return;
  const row = b.closest('.rv'), id = row.dataset.id, act = b.dataset.act;
  if (act === 'ok') writeReview(id, { status: 'approved', note: '' });
  else if (act === 'clear') writeReview(id, null);
  else if (act === 'note') { row.innerHTML = '<textarea placeholder="اكتب ملاحظتك على هذا الموضع">' + esc((R.rev[id] || {}).note || '') + '</textarea><button class="a" data-act="save">حفظ</button><button data-act="cancel">تراجع</button>'; row.querySelector('textarea').focus(); }
  else if (act === 'save') { const t = row.querySelector('textarea').value.trim(); if (t) writeReview(id, { status: 'note', note: t }); }
  else if (act === 'cancel') refreshOpen();
});
function refreshOpen() {
  document.querySelectorAll('.v').forEach((e) => e.classList.toggle('ok', e.dataset.q ? approvedAll(M, M.ws[e.dataset.w]) : approvedAll(B, B.wordSites[e.dataset.w])));
  if (!pop.classList.contains('show') || !pop.dataset.w || pop.querySelector('textarea')) return;
  const el = document.querySelector('.v.sel,.u.sel'); if (el) { const sc = pop.scrollTop; openWord(el); pop.scrollTop = sc; }
}
(async () => {
  if (typeof claude === 'undefined' || !claude.use) return;
  try { R.db = await claude.use('db'); } catch (e) { R.db = null; } if (!R.db) return;
  try { R.user = await claude.use('user'); } catch (e) { R.user = null; }
  let w = null; try { w = R.user ? await R.user.can('data.write') : null; } catch (e) {}
  R.can = w !== false; R.state = 'loading';
  const timer = setTimeout(() => { if (R.state === 'loading') { R.state = 'slow'; refreshOpen(); } }, 10000);
  R.db.collection('reviews').onSnapshot((snap) => { const m = {}; snap.docs.forEach((d) => { if (d.exists) m[d.id] = d.data(); }); R.rev = m; clearTimeout(timer); R.state = 'ready'; refreshOpen(); }, () => { clearTimeout(timer); R.state = 'slow'; refreshOpen(); });
})();

// ===== نافذة الكلمة =====
const skel = (w) => String(w).replace(/[ً-ٰٟۖ-ۭـ]/g, '').replace(/[اٱأإآ]/g, '').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ة/g, 'ه').replace(/[ءئ]/g, '');
function hl(text, word) { const k = skel(word); return esc(text).replace(/﴿([^﴾]+)﴾/g, (m, t) => (t.split(/\s*[،,]\s*/).some((p) => skel(p.replace(/\s+/g, '')) === k || p.split(/\s+/).some((q) => skel(q) === k)) ? '<b>﴿' + t + '﴾</b>' : m)); }
function closePop() { pop.classList.remove('show'); pop.dataset.w = ''; document.querySelectorAll('.v.sel,.u.sel,.qr.sel').forEach((e) => e.classList.remove('sel')); }
function showPop(h, w) { pop.innerHTML = '<div class="grab"></div>' + h; pop.dataset.w = w || ''; pop.classList.add('show'); pop.scrollTop = 0; }
function openWord(el) {
  closePop();
  const [s, a] = el.dataset.k.split(':');
  if (el.dataset.q) {
    const ids = M.ws[el.dataset.w] || []; el.classList.add('sel');
    let h = '<h2>' + esc(el.textContent) + '</h2><div class="ref">سورة ' + B.suras[s - 1].name + ' · الآية ' + ar(a) + (M.count ? ' (' + esc(M.count) + ')' : '') + '</div>';
    if (M.main) h += '<div class="rd"><div class="qt">﴿' + esc(el.textContent) + '﴾</div><div class="who">' + esc(M.main) + '</div></div>';
    for (const i of ids) { const x = M.sites[i]; h += '<div class="rd"><div class="w">﴿' + esc(x.w) + '﴾</div><div class="who">' + esc(x.r) + '</div>' + (x.n ? '<div class="nt">' + esc(x.n) + '</div>' : '') + '</div>' + (x.st === 'multiple' ? '<div class="chk">الموضع يحتاج مراجعة</div>' : '') + reviewRow(x.id); }
    return showPop(h + '<div class="warn">' + esc(M.warn || 'مسودة لم يعتمدها المراجع العلمي بعد.') + '</div>', el.dataset.w);
  }
  const ids = B.wordSites[el.dataset.w] || [], uls = B.wordUsul[el.dataset.w] || [];
  const same = ids.length ? [...document.querySelectorAll('.v')].filter((e) => (B.wordSites[e.dataset.w] || []).some((x) => ids.includes(x)) && e.dataset.k === el.dataset.k) : [el];
  same.forEach((e) => e.classList.add('sel'));
  let h = '<h2>' + esc(same.map((e) => e.textContent).join(' ')) + '</h2><div class="ref">سورة ' + B.suras[s - 1].name + ' · الآية ' + ar(a) + '</div>';
  for (const id of ids) { const x = B.sites[id]; if (x.sc) h += '<div class="ref">الموضع ' + esc(x.sc) + '</div>';
    for (const [w, who, nt] of x.v) h += '<div class="rd"><div class="w">﴿' + esc(w) + '﴾' + (who === 'الباقون' ? '<span class="tag">الباقون</span>' : '') + '</div><div class="who">' + esc(who) + '</div>' + (nt ? '<div class="nt">' + esc(nt) + '</div>' : '') + '</div>';
    if (x.st === 'shifted' || x.st === 'multiple') h += '<div class="chk">الموضع يحتاج مراجعة</div>'; h += reviewRow(x.id); }
  if (uls.length) { h += '<div class="uh">الأصول</div>'; for (const li of uls) { const [, hd, text] = B.usulLines[li]; h += '<div class="ul"><span class="hd2">' + esc(hd) + ':</span> ' + hl(text, el.textContent) + '</div>'; } }
  showPop(h + '<div class="warn">مسودة مستخرجة من مصحف الراجح، لم يعتمدها المراجع العلمي بعد.</div>', el.dataset.w);
}
function openUsul() { let h = '<h2 style="font-family:AM;font-size:22px;color:#1b4357">أصول الصفحة ' + ar(st.page) + '</h2>'; for (const [k, v] of Object.entries(B.usul[st.page])) h += '<h4>' + esc(k) + '</h4>' + v.map((x) => '<p>' + esc(x) + '</p>').join(''); showPop(h + '<div class="warn">مسودة لم يعتمدها المراجع العلمي بعد.</div>'); }
function openQUsul() { const md = (t) => t.split(/\n\n+/).map((b) => (b.startsWith('## ') ? '<h4>' + esc(b.slice(3)) + '</h4>' : b.startsWith('# ') ? '<h4>' + esc(b.slice(2)) + '</h4>' : '<p>' + esc(b).replace(/\n/g, '<br>') + '</p>')).join(''); showPop(M.usul.map(md).join('') + '<div class="warn">مسودة لم يعتمدها المراجع العلمي بعد.</div>'); }
document.addEventListener('click', (ev) => {
  const t = ev.target; if (pop.contains(t) || $('sheet').contains(t)) return;
  const qr = t.closest('.qr'); if (qr) { closePop(); qr.classList.add('sel'); const [s, a] = qr.dataset.k.split(':'); showPop('<h2>' + esc(qr.textContent) + '</h2><div class="ref">سورة ' + B.suras[s - 1].name + ' · الآية ' + ar(a) + '</div><div class="rd"><div class="who">' + esc(RWV.n) + '</div><div class="nt">الكلمة ملوّنة في المصحف المطبوع لمخالفتها رواية حفص، وليس عليها ملاحظة في الهامش.</div></div><div class="warn">مسودة لم يعتمدها المراجع العلمي بعد.</div>'); return; }
  const w = t.closest('.v,.u'); if (w) { if (SET.tap === 'one') openWord(w); return; }
  if (t.id === 'usb') return openUsul(); if (t.id === 'qusb') return openQUsul();
  const hd = t.closest('.hid'); if (hd) { reveal(hd.dataset.k); return; }
  if (pop.classList.contains('show') && !t.closest('#scrim')) { closePop(); ev.stopPropagation(); }
  else if (t.closest('#pages') && st.mode !== 'tj' && !t.closest('button,a,input,.hd')) document.body.classList.toggle('zen');
}, true);
document.addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT') return; if (e.key === 'ArrowLeft') go(st.page + 1); if (e.key === 'ArrowRight') go(st.page - 1); if (e.key === 'Escape') { closePop(); closeSheet(); } });
// سحب الصفحة يمينًا ويسارًا للتقليب (في القراءة والتسميع)
let tx0 = null; document.addEventListener('touchstart', (e) => { tx0 = st.mode === 'tj' || $('sheet').classList.contains('show') ? null : [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
document.addEventListener('touchend', (e) => { if (!tx0) return; const dx = e.changedTouches[0].clientX - tx0[0], dy = e.changedTouches[0].clientY - tx0[1]; if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) go(st.page + (dx > 0 ? 1 : -1)); tx0 = null; }, { passive: true });


// ===== البحث في نص المصحف المفتوح =====
const norm = (t) => skel(qd(t)).replace(/[^ء-ي ]/g, '');
function pageOfQ(i) { const w = qStart[i]; let lo = 0, hi = 603; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (M.pages[m] <= w) lo = m; else hi = m - 1; } return lo + 1; }
function sheetSearch(q = '') {
  let h = head('البحث') + '<input class="srch" id="sq" placeholder="اكتب كلمة أو جزءًا من آية" value="' + esc(q) + '"><p class="note">يبحث في نص ' + esc(RWV.title) + '.</p><div class="lst res">';
  const k = norm(q).trim();
  if (k.length >= 2) {
    const A = RWV.mushaf === 'base' ? B.ayahs : M.ayahs; let n = 0;
    for (let i = 0; i < A.length && n < 80; i++) { const [s, a, t] = A[i]; if (!norm(t).includes(k)) continue; n++;
      const p = RWV.mushaf === 'base' ? pageOfAyah(i) : pageOfQ(i);
      h += '<button class="it" data-go="' + p + '"><span class="no">' + ar(a) + '</span><span><span class="mt">سورة ' + esc(B.suras[s - 1].name) + '</span><br><span class="nm">' + esc(qd(t).split(' ').slice(0, 12).join(' ')) + '</span></span><span class="mt">ص ' + ar(p) + '</span></button>'; }
    h += n ? '' : '<p class="note">لا نتائج.</p>';
    if (n === 80) h += '<p class="note">تظهر أول ٨٠ نتيجة؛ زد كلمات البحث لتضييقها.</p>';
  }
  openSheet(h + '</div>');
  const si = $('sq'); si.focus(); si.setSelectionRange(q.length, q.length);
  let tmr; si.oninput = () => { clearTimeout(tmr); tmr = setTimeout(() => sheetSearch(si.value), 350); };
}


// ===== العلامات والملاحظات (على الجهاز) =====
const MK = { marks: LS.get('marks', {}), notes: LS.get('notes', {}) }; // المفتاح: الرواية:الصفحة
const mkKey = () => RWV.id + ':' + st.page;
function markUI() { $('bMark').classList.toggle('on', !!MK.marks[mkKey()]); }
function sheetMarks() {
  const k = mkKey(), on = !!MK.marks[k];
  let h = head('العلامات والملاحظات') + stopsHTML() + '<div class="grp"><h3>هذه الصفحة · ' + ar(st.page) + ' · ' + esc(RWV.n) + '</h3><div class="opt"><span>' + (on ? 'عليها علامة' : 'بلا علامة') + '</span><button class="btn' + (on ? ' o' : '') + '" data-mk>' + (on ? 'إزالة العلامة' : 'ضع علامة') + '</button></div>' +
    '<div class="opt" style="display:block"><textarea class="nt" id="ntx" placeholder="ملاحظتك على هذه الصفحة">' + esc(MK.notes[k] || '') + '</textarea><button class="btn" data-ntsave style="margin-top:6px">حفظ الملاحظة</button></div></div>';
  const all = [...new Set([...Object.keys(MK.marks), ...Object.keys(MK.notes)])].sort((a, b) => +a.split(':')[1] - +b.split(':')[1]);
  h += '<div class="grp"><h3>كل العلامات والملاحظات</h3><div class="lst">';
  for (const x of all) { const [rw, p] = x.split(':'); const r = RWS.get(rw); if (!r) continue;
    h += '<button class="it" data-mkgo="' + x + '"><span class="no">' + (MK.marks[x] ? '●' : '✎') + '</span><span>صفحة ' + ar(p) + ' · ' + esc(r.n) + (MK.notes[x] ? '<br><span class="mt">' + esc(MK.notes[x].slice(0, 60)) + '</span>' : '') + '</span><span class="mt"></span></button>'; }
  openSheet(h + (all.length ? '' : '<p class="note" style="padding:0 14px">لا شيء بعد.</p>') + '</div></div>');
}
$('bMark').onclick = sheetMarks;

// ===== الحفظ والنشاط (على الجهاز) =====
const day = (d = new Date()) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
const ACT = LS.get('act', {}); // يوم -> {r:[صفحات القراءة], m:[صفحات التسميع]}
let KH = LS.get('khatma', []); const GOAL = LS.get('goal', { hifz: 1, rev: 20 });
function track() {
  if (!B) return; const d = day(), a = (ACT[d] = ACT[d] || { r: [], m: [] }), f = st.mode === 'mem' ? 'm' : 'r';
  if (!a[f].includes(st.page)) { a[f].push(st.page); LS.set('act', ACT); }
  if (st.mode !== 'mem' && !KH.includes(st.page)) { KH.push(st.page); LS.set('khatma', KH); }
}
function streak() { let n = 0; const d = new Date(); if (!ACT[day(d)]) d.setDate(d.getDate() - 1); while (ACT[day(d)]) { n++; d.setDate(d.getDate() - 1); } return n; }
function sheetProgress() {
  const t = ACT[day()] || { r: [], m: [] }, pct = Math.round(KH.length / 6.04);
  let h = head('الحفظ والنشاط') + '<div class="stat"><div><b>' + ar(streak()) + '</b><span>أيام متتالية</span></div><div><b>' + ar(t.r.length) + '</b><span>صفحة قرأتها اليوم</span></div><div><b>' + ar(t.m.length) + '</b><span>صفحة سمّعتها اليوم</span></div></div>';
  h += '<div class="grp"><h3>الختمة الحالية · ' + ar(pct) + '٪ (' + ar(KH.length) + ' من ٦٠٤ صفحة)</h3><div class="prog"><i style="width:' + Math.min(100, pct) + '%"></i></div><div class="opt"><span class="mt">تُحسب كل صفحة قرأتها مرة واحدة</span><button class="btn o" data-khreset>ختمة جديدة</button></div></div>';
  const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const a = ACT[day(d)] || { r: [], m: [] }; days.push([d, a.r.length + a.m.length]); }
  const mx = Math.max(1, ...days.map((x) => x[1]));
  h += '<div class="grp"><h3>الصفحات · آخر ٧ أيام</h3><div class="bar7">' + days.map(([d, v]) => '<div>' + ar(v) + '<i style="height:' + Math.round((v / mx) * 70) + 'px"></i>' + ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'][d.getDay()] + '</div>').join('') + '</div></div>';
  const sel = (k, opts) => '<select data-goal="' + k + '">' + opts.map(([v, n]) => '<option value="' + v + '"' + (GOAL[k] == v ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>';
  h += '<div class="grp"><h3>الأهداف اليومية</h3><div class="opt"><span>هدف الحفظ (التسميع) · أنجزت ' + ar(t.m.length) + (t.m.length >= GOAL.hifz ? ' ✓' : '') + '</span>' + sel('hifz', [[1, 'وجه'], [2, 'وجهان'], [5, 'ربع حزب'], [10, 'نصف جزء']]) + '</div>' +
    '<div class="opt"><span>هدف المراجعة (القراءة) · أنجزت ' + ar(t.r.length) + (t.r.length >= GOAL.rev ? ' ✓' : '') + '</span>' + sel('rev', [[5, 'ربع جزء'], [10, 'نصف جزء'], [20, 'جزء'], [40, 'جزءان']]) + '</div></div>';
  h += '<button class="btn" data-act="mem" style="width:100%">ابدأ التسميع</button>';
  openSheet(h);
}
$('sheet').addEventListener('change', (e) => { const dk = e.target.dataset.k; if (dk) { SET[dk] = dk === 'autoSec' ? +e.target.value : e.target.value; LS.set(dk, SET[dk]); if (dk === 'theme') { applySet(); autoTheme(); } autoFlip(); return; } if (e.target.hasAttribute('data-font')) { SET.font = e.target.value; LS.set('font', SET.font); applySet(); render(); return; } if (e.target.hasAttribute('data-layout')) { SET.layout = e.target.value; LS.set('layout', SET.layout); edPages(); render(); return; } const g = e.target.dataset.goal; if (g) { GOAL[g] = +e.target.value; LS.set('goal', GOAL); sheetProgress(); } });

// ===== عن المصحف =====
function sheetAbout() {
  const src = RWV.plain ? 'النص: مشروع تنزيل (tanzil.net) برواية حفص عن عاصم.' : RWV.mushaf === 'base' ? 'النص: مشروع تنزيل · مواضع الخلاف والأصول: مصحف الراجح (الشاطبية والدرة).' : M.foot || '';
  let h = head('عن المصحف') + '<div class="grp"><h3>' + esc(RWV.title) + '</h3><div class="opt" style="display:block;line-height:1.9">' + esc(src) + (M && RWV.mushaf !== 'base' && M.count ? '<br>العدّ: ' + esc(M.count) : '') + '</div></div>';
  h += '<div class="grp"><h3>منهج المصحف</h3><div class="opt" style="display:block;line-height:1.9">النص كما رُسم في مصدره دون تغيير أو زيادة أو نقص، وألوان الكلمات كما في مفتاح ألوان المصدر، وملاحظات الهامش منقولة من المصحف المطبوع ومربوطة بكلماتها. وما خالف المصدر فبقرار من المشرف مسجّل.</div></div>';
  h += '<div class="grp"><h3>الحالة</h3><div class="opt" style="display:block;line-height:1.9">مسودة للمراجعة، لم تعتمدها اللجنة العلمية بعد.</div></div>';
  openSheet(h);
}

// ===== إبقاء الشاشة مضيئة =====
let wl = null;
async function wake() { if (!SET.wake || !('wakeLock' in navigator) || document.hidden) return; try { wl = await navigator.wakeLock.request('screen'); } catch (e) {} }
document.addEventListener('visibilitychange', wake);


// ===== مميزات إضافية: آخر القراءة، الفهرس الكامل، التقليب التلقائي، اللمس =====
let RECENT = LS.get('recent', []);
function pushRecent() { const s = firstSura(st.page); RECENT = [{ p: st.page, s, rw: RWV.id }].concat(RECENT.filter((x) => !(x.p === st.page && x.rw === RWV.id))).slice(0, 6); LS.set('recent', RECENT); }
function sheetIndex(tab = 'sura', q = '') {
  const T = [['sura', 'السور'], ['juz', 'الأجزاء'], ['hizb', 'الأحزاب'], ['page', 'الصفحات']];
  let h = head('الفهرس');
  if (RECENT.length) h += '<div class="rec">' + RECENT.map((r) => '<button data-go="' + r.p + '" data-rwgo="' + r.rw + '"><b>' + esc(B.suras[r.s - 1].name) + '</b><span>ص ' + ar(r.p) + ' · ' + esc((RWS.get(r.rw) || {}).n || '') + '</span></button>').join('') + '</div>';
  h += jumpJuz() + '<div class="tabs t4">' + T.map(([k, n]) => '<button data-tab="' + k + '" class="' + (tab === k ? 'on' : '') + '">' + n + '</button>').join('') + '</div><div class="lst">';
  const pg = (s, a) => pageOfAyah(ayahIdx.get(s + ':' + a));
  if (tab === 'sura') {
    h += '<input class="srch" id="srch" placeholder="اسم السورة أو رقمها أو مكية/مدنية" value="' + esc(q) + '">';
    const qq = q.trim().replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c));
    B.suras.forEach((s, i) => { if (qq && !(String(i + 1) === qq || s.name.includes(qq) || (s.t || '').includes(qq))) return; const p = pg(i + 1, 1);
      h += '<button class="it" data-go="' + p + '"><span class="no">' + ar(i + 1) + '</span><span><span class="nm sn">سُورَةُ ' + esc(s.name) + '</span><br><span class="mt">' + esc(s.t || '') + ' · ' + ar(s.ayahs) + ' آية</span></span><span class="mt">ص ' + ar(p) + '</span></button>'; });
  } else if (tab === 'juz') {
    B.juzStarts.forEach(([s, a], k) => { const p = pg(s, a); h += '<button class="it" data-go="' + p + '"><span class="no">' + ar(k + 1) + '</span><span>الجزء ' + ar(k + 1) + '<br><span class="mt">' + esc(B.suras[s - 1].name) + ' · آية ' + ar(a) + '</span></span><span class="mt">ص ' + ar(p) + '</span></button>'; });
  } else if (tab === 'hizb') {
    (B.hizbQ || []).forEach(([s, a], k) => { const p = pg(s, a), q4 = k % 4; h += '<button class="it" data-go="' + p + '"><span class="no">' + ar(Math.floor(k / 4) + 1) + '</span><span>' + ['الحزب ' + ar(Math.floor(k / 4) + 1), 'ربع الحزب', 'نصف الحزب', 'ثلاثة أرباع الحزب'][q4] + '<br><span class="mt">' + esc(B.suras[s - 1].name) + ' · آية ' + ar(a) + '</span></span><span class="mt">ص ' + ar(p) + '</span></button>'; });
  } else {
    h += '<div class="pgrid">'; for (let p = 1; p <= 604; p++) h += '<button data-go="' + p + '">' + ar(p) + '</button>'; h += '</div>';
  }
  openSheet(h + '</div>');
  const si = $('srch'); if (si) { si.oninput = () => { const v = si.value; sheetIndex('sura', v); const n = $('srch'); n.focus(); n.setSelectionRange(v.length, v.length); }; }
}
// التقليب التلقائي
let autoT = null;
function autoFlip() { clearInterval(autoT); autoT = null; if (SET.auto && st.mode === 'show') autoT = setInterval(() => { if (!$('sheet').classList.contains('show') && !pop.classList.contains('show')) go(st.page + 1); }, SET.autoSec * 1000); }
// لمس حافتي الشاشة
document.addEventListener('click', (e) => {
  if (!SET.edge || st.mode === 'tj' || !e.target.closest('#pages') || e.target.closest('.v,.u,button,a,.hid')) return;
  const x = e.clientX, W = innerWidth;
  if (x > W * 0.85) { e.stopImmediatePropagation(); go(st.page - 1); } else if (x < W * 0.15) { e.stopImmediatePropagation(); go(st.page + 1); }
}, true);
// المظهر التلقائي
function autoTheme() { if (SET.theme === 'auto') { const d = matchMedia('(prefers-color-scheme: dark)').matches; document.body.classList.toggle('bg-night', d); } }
matchMedia('(prefers-color-scheme: dark)').addEventListener && matchMedia('(prefers-color-scheme: dark)').addEventListener('change', autoTheme);


// ===== الأرباع، الأجزاء الجانبية، المصاحف، ما الجديد، نصيحة اليوم =====
function quartersOn(p) { // أرباع الأحزاب التي تبدأ في هذه الصفحة (حسب طبعة حفص)
  const out = []; (B.hizbQ || []).forEach(([s, a], k) => { if (pageOfAyah(ayahIdx.get(s + ':' + a)) === p) out.push(k); }); return out;
}
const qName = (k) => (k % 4 === 0 ? 'الحزب ' + ar(k / 4 + 1) : ['', 'ربع', 'نصف', 'ثلاثة أرباع'][k % 4] + ' الحزب ' + ar(Math.floor(k / 4) + 1));
function decoratePage() {
  const hd = document.querySelector('#page .hd'); if (!hd) return;
  const q = RWV.mushaf === 'base' || RWV.plain ? quartersOn(st.page) : [];
  if (q.length) { const s = document.createElement('span'); s.className = 'qtr'; s.textContent = '۞ ' + q.map(qName).join(' · '); hd.appendChild(s); if (SET.qAlert) toast('بداية ' + qName(q[0])); }
  document.querySelector('#page').classList.toggle('marked', !!MK.marks[mkKey()]);
}
const NEWS = [
  ['٢٥ نوفمبر ٢٠٢٦', 'أسطر طبعة المجمع ١٤٢١ و١٤٠٥ لمصحف حفص، وفهرس السور والأجزاء والأحزاب، والتقليب التلقائي، وإعدادات اللمس.'],
  ['٢٥ نوفمبر ٢٠٢٦', 'هامش مصحف ورش المطبوع كاملًا (٦٠٤ صفحة)، ووضع التهجد، والتسميع، والعلامات والملاحظات، والبحث.'],
  ['٢٤ نوفمبر ٢٠٢٦', 'مصحف ورش عن نافع، ومصحف ابن عامر (هشام وفي هامشه ابن ذكوان).'],
];
const TIPS = ['المس الصفحة مرة لتختفي الأزرار وتبقى صفحة المصحف وحدها.', 'المس الكلمة الملوّنة لترى حكمها وهامش المطبوع.', 'في التسميع: «أظهر الآية التالية» يكشف الآيات واحدة واحدة.', 'من القائمة تختار طبعة المجمع ١٤٢١ أو ١٤٠٥ أو النص الملتف.', 'وضع التهجد يمرّر الصفحات تلقائيًا بالسرعة التي تختارها.', 'الروايات تُنزَّل مرة واحدة ثم تعمل دون اتصال.'];
function dailyTip() { const d = day(); if (!SET.tips || LS.get('tipDay', '') === d) return; LS.set('tipDay', d); setTimeout(() => toast('هل تعلم؟ ' + TIPS[new Date().getDate() % TIPS.length], 5000), 1500); }
function sheetNews() { openSheet(head('ما الجديد') + NEWS.map(([d, t]) => '<div class="grp"><h3>' + d + '</h3><div class="opt" style="display:block;line-height:1.9">' + esc(t) + '</div></div>').join('')); }
async function sheetMushafs() {
  const seen = new Set(); let h = head('المصاحف');
  const all = [...(REG.extra || []).map((r) => ({ ...r })), ...[...RWS.values()].filter((r) => r.status === 'ready')];
  for (const r of all) {
    const key = r.mushaf + (r.plain ? '-p' : ''); if (seen.has(key) || r.id === 'ashr' && seen.has('base-x')) continue; seen.add(key); if (r.id === 'ashr') seen.add('base-x');
    const saved = r.mushaf === 'base' || mushafCache[r.mushaf] || (await isSaved('data/m/' + r.mushaf + '.json'));
    const src = r.mushaf === 'base' ? (r.plain ? 'نص مشروع تنزيل · أسطر طبعة المجمع' : 'نص تنزيل · الخلاف من مصحف الراجح (الشاطبية والدرة)') : r.mushaf === 'sila' ? 'نص قالون الرقمي (المجمع) · هامش مصحف أصحاب الصلة' : r.mushaf === 'warsh' ? 'هامش مصحف ورش المطبوع (الأزرق)' : r.mushaf === 'hisham' ? 'هامش مصحف ابن عامر' : '';
    h += '<div class="mc"><div class="mct"><b>' + esc(r.mushaf === 'sila' ? 'مصحف أصحاب الصلة' : r.mushaf === 'hisham' ? 'مصحف ابن عامر' : r.title) + '</b><span class="tag">' + (saved ? 'محفوظ دون اتصال' : 'يُنزَّل عند الفتح') + '</span></div>' +
      '<div class="mcs"><span><b>٦٠٤</b>صفحة</span><span><b>' + (r.mushaf === 'base' ? '١٥' : '—') + '</b>سطرًا</span><span><b>مسودة</b>الحالة</span></div><div class="mt">' + esc(src) + '</div><button class="btn" data-rw="' + r.id + '" style="margin-top:8px;width:100%">افتح</button></div>';
  }
  openSheet(h);
}
function jumpJuz() { let h = '<div class="jz">'; for (let k = 1; k <= 30; k++) { const [s, a] = B.juzStarts[k - 1]; h += '<button data-go="' + pageOfAyah(ayahIdx.get(s + ':' + a)) + '">' + ar(k) + '</button>'; } return h + '</div>'; }

// ===== البدء: حفص دائمًا عند الفتح =====
(async () => {
  applySet();
  try {
    REG = await getJSON('data/riwayat.json');
    REG.qurra.forEach((q) => q.r.forEach((r) => RWS.set(r.id, { ...r, q: q.q })));
    (REG.extra || []).forEach((r) => RWS.set(r.id, { ...r, q: '' }));
    B = await getJSON('data/m/base.json'); indexBase();
    RWV = RWS.get(REG.home || 'hafs');
    const hp = location.hash.match(/page=(\d+)/); if (hp) st.page = +hp[1];
    if (!(st.page >= 1 && st.page <= 604)) st.page = 1;
    const hr = location.hash.match(/rw=([\w-]+)/); if (hr && RWS.get(hr[1])?.status === 'ready') { await openRw(hr[1]); return; }
    render(); wake(); autoTheme(); dailyTip();
    { const last = Object.keys(STOPS).filter((id) => STOPS[id]).sort((x, y) => STOPS[y].t - STOPS[x].t)[0];
      if (last) { const e = $('toast'); e.innerHTML = 'موقف «' + sName(last) + '»: ' + stopLabel(STOPS[last]) + ' <button id="stopGo" class="stpgo">انتقل إليه</button>'; e.classList.add('show'); setTimeout(hideToast, 7000); $('stopGo').onclick = () => goStop(last); } }
  } catch (e) { $('pages').innerHTML = '<div class="pg"><div class="in"><p class="ld">تعذّر تحميل المصحف. تحقق من الاتصال ثم أعد فتح الصفحة.</p></div></div>'; }
})();
window.__app = { st, go, setMode, openRw };
