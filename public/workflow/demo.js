(function () {
  'use strict';
  var sample = 'name,email,received_at,status,last_contact,owner\nJordan Lee,jordan@example.com,2026-09-25,quoted,2026-09-27,Sam\nMorgan Chen,morgan@example.com,2026-10-01,new,,Taylor\nAlex Rivera,alex@example.com,2026-09-30,new,,\nCasey Park,casey@example.com,2026-09-29,contacted,2026-09-30,Sam\nRiley Quinn,riley@example.com,2026-09-24,won,2026-09-26,Taylor';
  var csv = document.getElementById('csv'), date = document.getElementById('review-date'), result = document.getElementById('result'), summary = document.getElementById('summary'), error = document.getElementById('error'), download = document.getElementById('download'), latest = null;
  function node(tag, className, text) { var el = document.createElement(tag); if (className) el.className = className; el.textContent = text; return el; }
  function run() {
    error.hidden = true; result.replaceChildren(); latest = null; download.disabled = true;
    try {
      var records = TrafficScoutQueue.parseCsv(csv.value);
      latest = TrafficScoutQueue.build(records, date.value);
      summary.textContent = latest.queue.length + ' open inquiries · ' + latest.closed + ' closed · review date ' + date.value;
      if (!latest.queue.length) result.append(node('p', 'fine', 'No open inquiries. Closed records remain in the original list.'));
      latest.queue.forEach(function (r) {
        var card = node('article', 'result-card', ''), top = node('div', 'result-top', '');
        top.append(node('span', '', r.name), node('span', 'pill ' + r.priority.toLowerCase(), r.priority));
        card.append(top, node('p', '', r.action), node('p', 'fine', r.owner + ' · Due ' + (r.due_at || 'needs review') + ' · Source row ' + r.source_row)); result.append(card);
      });
      download.disabled = false;
    } catch (e) { summary.textContent = 'Queue not generated.'; error.textContent = e.message; error.hidden = false; }
  }
  document.getElementById('run').addEventListener('click', run);
  document.getElementById('reset').addEventListener('click', function () { csv.value = sample; date.value = '2026-10-01'; run(); });
  download.addEventListener('click', function () {
    if (!latest) return;
    var url = URL.createObjectURL(new Blob(['\uFEFF' + TrafficScoutQueue.toCsv(latest.queue)], {type:'text/csv;charset=utf-8'}));
    var a = document.createElement('a'); a.href = url; a.download = 'trafficscout-follow-ups-' + date.value + '.csv'; document.body.append(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });
  [csv, date].forEach(function (el) { el.addEventListener('input', function () { latest = null; download.disabled = true; summary.textContent = 'Inputs changed. Build the queue to update the results.'; result.replaceChildren(); error.hidden = true; }); });
  csv.value = sample; run();
}());
