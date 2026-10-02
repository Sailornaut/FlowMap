/* Shared by the browser demo and the Google Sheets delivery. No network calls. */
var TrafficScoutQueue = (function () {
  'use strict';
  var DAY = 86400000;
  function day(value) {
    var text = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    var n = Date.parse(text + 'T12:00:00Z');
    return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === text ? Math.floor(n / DAY) : null;
  }
  function parseCsv(text) {
    text = String(text).replace(/^\uFEFF/, '');
    var rows = [], row = [], field = '', quoted = false, ended = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') { quoted = false; ended = true; }
        else field += ch;
      } else if (ch === '"') {
        if (field.length || ended) throw new Error('Unexpected quote in CSV.');
        quoted = true;
      } else if (ch === ',' || ch === '\n' || ch === '\r') {
        row.push(field); field = ''; ended = false;
        if (ch !== ',') { rows.push(row); row = []; if (ch === '\r' && text[i + 1] === '\n') i++; }
      } else {
        if (ended) throw new Error('Unexpected text after a quoted CSV field.');
        field += ch;
      }
    }
    if (quoted) throw new Error('CSV contains an unclosed quote.');
    if (field.length || row.length || ended) { row.push(field); rows.push(row); }
    if (!rows.length || !rows.some(function (r) { return r.some(function (c) { return c.trim(); }); })) throw new Error('Add a CSV header and at least one inquiry.');
    var headers = rows.shift().map(function (h) { return h.trim().toLowerCase(); });
    if (new Set(headers).size !== headers.length) throw new Error('CSV headers must be unique.');
    ['name', 'email', 'received_at', 'status', 'last_contact', 'owner'].forEach(function (h) {
      if (headers.indexOf(h) < 0) throw new Error('Missing column: ' + h);
    });
    var records = rows.map(function (r, i) {
      if (!r.some(function (c) { return c.trim(); })) return null;
      if (r.length !== headers.length) throw new Error('CSV row ' + (i + 2) + ' has the wrong number of fields.');
      var out = {};
      headers.forEach(function (h, j) { out[h] = r[j].trim(); });
      out._sourceRow = i + 2;
      return out;
    }).filter(function (r) { return r !== null; });
    if (records.length > 1000) throw new Error('This demo supports up to 1,000 inquiries.');
    return records;
  }
  function build(records, today) {
    var now = day(today);
    if (now === null) throw new Error('Choose a valid review date.');
    var seen = {};
    records.forEach(function (r) { var key = String(r.email || '').trim().toLowerCase(); if (key) seen[key] = (seen[key] || 0) + 1; });
    var queue = [], closed = 0;
    records.forEach(function (r, index) {
      var status = String(r.status || '').trim().toLowerCase();
      if (status === 'won' || status === 'lost') { closed++; return; }
      var issues = [], received = day(r.received_at), contact = r.last_contact ? day(r.last_contact) : null;
      var email = String(r.email || '').trim();
      if (!String(r.name || '').trim()) issues.push('Missing name');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push('Check email');
      if (received === null || received > now) issues.push('Check received date');
      if (r.last_contact && (contact === null || contact > now || (received !== null && contact < received))) issues.push('Check last contact date');
      if (['new', 'contacted', 'quoted'].indexOf(status) < 0) issues.push('Check status');
      if ((status === 'contacted' || status === 'quoted') && contact === null) issues.push('Add last contact date');
      if (!String(r.owner || '').trim()) issues.push('Assign an owner');
      if (seen[email.toLowerCase()] > 1) issues.push('Repeated email: review, do not merge');
      var due = status === 'new' ? received : contact === null ? null : contact + 2;
      var priority = issues.length ? 'Review' : due < now ? 'Overdue' : due === now ? 'Today' : 'Upcoming';
      var action = issues.length ? issues.join('; ') : status === 'new' ? 'Respond to inquiry' : status === 'quoted' ? 'Follow up on quote' : 'Follow up with prospect';
      queue.push({name:r.name || '(No name)', email:email, owner:r.owner || 'Unassigned', status:status || '(Missing)', priority:priority, action:action,
        due_at:due === null ? '' : new Date(due * DAY).toISOString().slice(0, 10), source_row:r._sourceRow || index + 2});
    });
    var rank = {Review:0, Overdue:1, Today:2, Upcoming:3};
    queue.sort(function (a, b) { return rank[a.priority] - rank[b.priority] || a.due_at.localeCompare(b.due_at) || a.source_row - b.source_row; });
    return {queue:queue, closed:closed, total:records.length};
  }
  function safeCell(value) {
    var text = String(value == null ? '' : value);
    return /^[\s\uFEFF]*[=+\-@]/.test(text) ? "'" + text : text;
  }
  function toCsv(queue) {
    var fields = ['name', 'email', 'owner', 'status', 'priority', 'due_at', 'action', 'source_row'];
    function encode(value) { return '"' + safeCell(value).replace(/"/g, '""') + '"'; }
    return [fields.join(',')].concat(queue.map(function (r) { return fields.map(function (f) { return encode(r[f]); }).join(','); })).join('\r\n');
  }
  return {parseCsv:parseCsv, build:build, toCsv:toCsv, safeCell:safeCell};
}());
if (typeof module !== 'undefined' && module.exports) module.exports = TrafficScoutQueue;
