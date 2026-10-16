/* ===== Core data logic (pure functions) ===== */
const Core = (() => {
  const FIELDS = [
    { key: 'name', label: 'Name', required: true },
    { key: 'gender', label: 'Gender', required: true },
    { key: 'cohort', label: 'Cohort / year' },
    { key: 'experience', label: 'Experience' },
    { key: 'extra', label: 'Extra info (position, sport…)' },
    { key: 'phone', label: 'Phone' },
    { key: 'photo', label: 'Photo link / file' },
    { key: 'email', label: 'Email (for duplicates)' },
  ];

  function cleanText(s) {
    const C1 = { '\x91': '‘', '\x92': '’', '\x93': '“', '\x94': '”', '\x96': '–', '\x97': '—', '\x85': '…' };
    s = String(s ?? '').replace(/ /g, ' ').replace(/[\x80-\x9f]/g, c => C1[c] || '');
    s = s.replace(/([A-Za-z])\uFFFD([A-Za-z])/g, "$1’$2").replace(/\uFFFD/g, '');
    return s.replace(/\s+/g, ' ').trim();
  }
  function capWord(w) {
    return w.replace(/(^|[-'’])([a-zà-ÿ])/g, (m, p, c) => p + c.toUpperCase());
  }
  function cleanName(s) {
    s = cleanText(s).replace(/^[\s.,_-]+|[\s.,_-]+$/g, '');
    if (!s) return '';
    const letters = s.replace(/[^A-Za-z]/g, '');
    if (letters && (letters === letters.toLowerCase() || letters === letters.toUpperCase())) {
      return s.toLowerCase().split(' ').map(capWord).join(' ');
    }
    return s.split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
  }
  function tokens(s) { return cleanText(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); }
  function squash(s) { return tokens(s).join(''); }

  function nickname(name, nick) {
    if (!cleanText(nick)) return '';
    if (squash(nick) === squash(name)) return '';
    const nt = tokens(name);
    const kt = tokens(nick);
    if (kt.every(t => nt.includes(t))) return '';
    return cleanName(nick);
  }

  function normGender(v) {
    const s = cleanText(v).toLowerCase().replace(/[^a-z]/g, '');
    if (/^(f|female|girl|girls|woman|women|w|ladies|lady)$/.test(s)) return 'F';
    if (/^(m|male|boy|boys|man|men|gents)$/.test(s)) return 'M';
    return 'U';
  }

  function cleanPhone(v) {
    let d = String(v ?? '').replace(/[^\d]/g, '');
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    if (!d || d.replace(/0/g, '').length <= 1 || /^(\d)\1+$/.test(d)) return '';
    if (d.length === 10) return d.slice(0, 5) + ' ' + d.slice(5);
    return d;
  }

  const PLACEHOLDER = /^(n\/?a|nil+|none|null|nothing|no|nope|not applicable|-+|_+|—|\.+)$/i;
  function cleanExperience(v) {
    let s = cleanText(v);
    s = s.replace(/\s*\?{2,}/g, '');          // emoji lost in export show up as ??
    s = s.replace(/\.{3,}/g, '…').replace(/^[\s.…]+/, '').trim();
    if (!s || PLACEHOLDER.test(s.replace(/[.\s]+$/, ''))) return '';
    return s[0].toUpperCase() + s.slice(1);
  }

  // last path segment of a link, decoded; also handles plain filenames
  function photoKey(v) {
    let s = String(v ?? '').trim();
    if (!s) return '';
    s = s.split(/[;\n]/)[0].trim();
    s = s.replace(/[?#].*$/, '');
    let seg = s.split('/').pop();
    try { seg = decodeURIComponent(seg); } catch (e) {}
    return seg.trim();
  }
  function stripExt(f) { return f.replace(/\.[a-z0-9]{2,5}$/i, ''); }
  // Microsoft Forms names uploads "original_Respondent Name.ext"
  function respondentFromFile(f) {
    const base = stripExt(f);
    const i = base.lastIndexOf('_');
    return (i >= 0 ? base.slice(i + 1) : base).replace(/\s+\d+$/, '');
  }

  function detectMapping(headers, rows) {
    const m = {};
    const used = new Set();
    const H = headers.map(h => ({ h, l: String(h).toLowerCase().trim() }));
    const sample = rows.slice(0, 40);
    const pick = (key, test) => {
      if (m[key]) return;
      const hit = H.find(x => !used.has(x.h) && test(x.l, x.h));
      if (hit) { m[key] = hit.h; used.add(hit.h); }
    };
    H.forEach(x => { if (/^(id|start time|completion time|timestamp|last modified time)$/.test(x.l)) used.add(x.h); });
    pick('email', l => /e-?mail/.test(l));
    pick('photo', l => /photo|picture|pic\b|image|upload|selfie/.test(l));
    pick('phone', l => /phone|mobile|contact|whatsapp/.test(l));
    // gender by values: a column where most answers are male/female
    const g = H.filter(x => !used.has(x.h)).map(x => {
      const vals = sample.map(r => r[x.h]).filter(v => cleanText(v));
      const ok = vals.filter(v => normGender(v) !== 'U').length;
      return { x, score: vals.length ? ok / vals.length : 0 };
    }).sort((a, b) => b.score - a.score)[0];
    if (g && g.score >= 0.6) { m.gender = g.x.h; used.add(g.x.h); }
    pick('gender', l => /gender|\bsex\b/.test(l));
    pick('name', l => /^(name|full name|player name|your name|student name)$/.test(l));
    pick('name', l => /name/.test(l) && !/nick|team|preferred/.test(l));
    pick('nick', l => /name|nick|preferred/.test(l));
    pick('cohort', l => /cohort|batch|year|department|dept|class|programme|program|course/.test(l));
    pick('experience', l => /experience|achievement|\bexp\b|played|skill|level/.test(l));
    pick('extra', l => /position|role|sport|event/.test(l));
    return m;
  }

  function buildPlayers(rows, map) {
    return rows.map((r, i) => {
      const name = cleanName(r[map.name]);
      return {
        row: i + 2,
        name,
        nick: map.nick ? nickname(name, r[map.nick]) : '',
        gender: map.gender ? normGender(r[map.gender]) : 'U',
        rawGender: map.gender ? cleanText(r[map.gender]) : '',
        cohort: map.cohort ? cleanText(r[map.cohort]) : '',
        experience: map.experience ? cleanExperience(r[map.experience]) : '',
        extra: map.extra ? cleanText(r[map.extra]) : '',
        phone: map.phone ? cleanPhone(r[map.phone]) : '',
        rawPhone: map.phone ? cleanText(r[map.phone]) : '',
        email: map.email ? cleanText(r[map.email]).toLowerCase() : '',
        photoKey: map.photo ? photoKey(r[map.photo]) : '',
      };
    }).filter(p => p.name);
  }

  // returns rows (by .row) that are older copies of a later submission
  function findDuplicates(players) {
    const groups = new Map();
    players.forEach(p => {
      const keys = [];
      if (p.email) keys.push('e:' + p.email);
      const d = p.rawPhone.replace(/\D/g, '').slice(-10);
      if (d && cleanPhone(p.rawPhone)) keys.push('np:' + squash(p.name) + d);
      keys.push('n:' + squash(p.name) + '|' + squash(p.cohort));
      keys.forEach(k => { if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); });
    });
    const dup = new Map();
    groups.forEach(list => {
      if (list.length < 2) return;
      const keep = list[list.length - 1];
      list.slice(0, -1).forEach(p => { if (p !== keep) dup.set(p.row, keep.row); });
    });
    return dup; // row -> row it duplicates
  }

  function normKey(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  // files: array of {name}; returns Map(playerRow -> file)
  function matchPhotos(players, files) {
    const byName = new Map(), byStem = new Map(), byResp = new Map();
    files.forEach(f => {
      byName.set(f.name.toLowerCase(), f);
      byStem.set(normKey(stripExt(f.name)), f);
      const r = normKey(respondentFromFile(f.name));
      if (r) { if (!byResp.has(r)) byResp.set(r, []); byResp.get(r).push(f); }
    });
    const out = new Map();
    players.forEach(p => {
      let f = null;
      if (p.photoKey) {
        f = byName.get(p.photoKey.toLowerCase()) || byStem.get(normKey(stripExt(p.photoKey)));
        if (!f) {
          const r = byResp.get(normKey(respondentFromFile(p.photoKey)));
          if (r && r.length === 1) f = r[0];
        }
      }
      if (!f) {
        for (const n of [p.name, p.nick]) {
          const r = n && byResp.get(normKey(n));
          if (r && r.length) { f = r[r.length - 1]; break; }
        }
      }
      if (f) out.set(p.row, f);
    });
    return out;
  }

  function initials(name) {
    const t = cleanText(name).split(' ').filter(w => /[A-Za-z]/.test(w));
    return ((t[0] || '?')[0] + (t.length > 1 ? t[t.length - 1][0] : '')).toUpperCase();
  }

  return { FIELDS, cleanText, cleanName, nickname, normGender, cleanPhone, cleanExperience,
    photoKey, respondentFromFile, detectMapping, buildPlayers, findDuplicates, matchPhotos, initials };
})();
if (typeof module !== 'undefined') module.exports = Core;
