import type { ApiSpec, EndpointSpec, FieldSpec } from "./types.js";

export function generateHtmlDashboard(api: ApiSpec): string {
  const endpointsJson = JSON.stringify(api.endpoints).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  const allTags = Array.from(new Set(api.endpoints.flatMap((e) => e.tags)));
  const tagsHtml = allTags.map((t) => `<button type="button" class="tag-btn" onclick="return filterByTag('${escapeHtml(t)}', this)">${escapeHtml(t)}</button>`).join("");
  const allTagsJson = JSON.stringify(allTags);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(api.title)} · API Dashboard</title>
  <style>
    :root { color-scheme: dark; --bg:#070912; --panel:rgba(17,24,39,.7); --card:rgba(23,32,51,.7); --line:rgba(148,163,184,.18); --text:#e8eefc; --muted:#9aa7bd; --accent:#7c3aed; --accent-2:#22d3ee; --ok:#10b981; --warn:#f59e0b; --err:#ef4444; }
    * { box-sizing: border-box; }
    html, body { margin:0; padding:0; }
    body { font:14px/1.55 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; background:radial-gradient(1200px 800px at 10% -10%, rgba(124,58,237,.25), transparent 60%), radial-gradient(900px 600px at 110% 10%, rgba(34,211,238,.18), transparent 60%), var(--bg); color:var(--text); min-height:100vh; }
    a { color:inherit; }
    button { font:inherit; }
    .err { position:fixed; top:0; left:0; right:0; background:var(--err); color:#fff; padding:12px 16px; z-index:99999; font-family:ui-monospace,monospace; white-space:pre-wrap; display:none; }
    .app { display:grid; grid-template-columns:260px 1fr; min-height:100vh; }
    aside { position:sticky; top:0; align-self:start; height:100vh; padding:24px 18px; border-right:1px solid var(--line); background:rgba(8,11,18,.7); backdrop-filter:blur(18px); overflow:auto; }
    aside h2 { margin:0 0 14px; font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); }
    .brand { display:flex; align-items:center; gap:10px; margin-bottom:24px; }
    .brand .logo { width:32px; height:32px; border-radius:10px; background:conic-gradient(from 140deg, #7c3aed, #22d3ee, #7c3aed); box-shadow:0 8px 24px rgba(124,58,237,.4); }
    .brand h1 { margin:0; font-size:16px; letter-spacing:-.01em; }
    .brand p { margin:0; font-size:11px; color:var(--muted); }
    nav.endpoint-list a { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:10px; color:var(--text); text-decoration:none; font-size:13px; background:rgba(255,255,255,.02); border:1px solid transparent; margin-bottom:4px; transition:all .18s ease; cursor:pointer; }
    nav.endpoint-list a:hover { background:rgba(124,58,237,.12); border-color:rgba(124,58,237,.35); transform:translateX(2px); }
    main { padding:28px clamp(16px,4vw,40px) 60px; min-width:0; }
    .topbar { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:24px; flex-wrap:wrap; }
    .topbar h1 { margin:0; font-size:clamp(24px,3vw,34px); letter-spacing:-.03em; }
    .topbar p { margin:4px 0 0; color:var(--muted); }
    .tabs { display:inline-flex; gap:4px; padding:6px; border:1px solid var(--line); border-radius:14px; background:var(--panel); backdrop-filter:blur(14px); }
    .tabs button { appearance:none; border:0; background:transparent; color:var(--muted); padding:9px 16px; border-radius:10px; cursor:pointer; font-weight:600; transition:all .2s ease; }
    .tabs button:hover { color:var(--text); background:rgba(124,58,237,.16); }
    .tabs button.on { color:#070912; background:linear-gradient(135deg, #c4b5fd, #67e8f9); box-shadow:0 8px 22px rgba(124,58,237,.35); }
    .panel { background:linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.02)); border:1px solid var(--line); border-radius:22px; padding:22px; backdrop-filter:blur(16px); box-shadow:0 30px 80px rgba(0,0,0,.25); }
    .grid { display:grid; gap:16px; }
    .grid-3 { grid-template-columns:repeat(3,minmax(0,1fr)); }
    .grid-2 { grid-template-columns:repeat(2,minmax(0,1fr)); }
    @media (max-width:900px) { .grid-3, .grid-2 { grid-template-columns:1fr; } .app { grid-template-columns:1fr; } aside { position:relative; height:auto; border-right:0; border-bottom:1px solid var(--line); } }
    .stat { display:flex; flex-direction:column; gap:6px; }
    .stat .num { font-size:30px; font-weight:800; letter-spacing:-.02em; background:linear-gradient(120deg, #c4b5fd, #67e8f9); -webkit-background-clip:text; background-clip:text; color:transparent; }
    .stat .label { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.1em; }
    .section-title { margin:0 0 14px; font-size:13px; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); }
    .endpoint { border:1px solid var(--line); border-radius:18px; padding:18px 20px; margin-bottom:14px; background:rgba(255,255,255,.025); transition:border-color .2s ease; }
    .endpoint:hover { border-color:rgba(124,58,237,.4); }
    .endpoint header { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:8px; }
    .endpoint h3 { margin:0; font-size:17px; letter-spacing:-.01em; }
    .endpoint p { margin:6px 0 12px; color:var(--muted); }
    .badge { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; font-weight:700; font-size:11px; letter-spacing:.04em; text-transform:uppercase; }
    .method { background:rgba(16,185,129,.18); color:#bbf7d0; }
    .method.POST { background:rgba(245,158,11,.18); color:#fde68a; }
    .method.PUT, .method.PATCH { background:rgba(34,211,238,.18); color:#a5f3fc; }
    .method.DELETE { background:rgba(239,68,68,.18); color:#fecaca; }
    .method.GET { background:rgba(124,58,237,.18); color:#ddd6fe; }
    code { color:#c4b5fd; font:13px/1.4 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace; }
    pre { background:#0b1020; padding:14px 16px; border-radius:12px; overflow:auto; border:1px solid var(--line); font:12.5px/1.55 'JetBrains Mono', ui-monospace, monospace; }
    table { width:100%; border-collapse:separate; border-spacing:0; margin:8px 0 4px; border:1px solid var(--line); border-radius:14px; overflow:hidden; }
    th, td { padding:10px 12px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
    th { color:#cbd5e1; background:rgba(255,255,255,.05); font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
    tr:last-child td { border-bottom:0; }
    .tag { display:inline-block; padding:2px 8px; border-radius:6px; background:rgba(34,211,238,.16); color:#a5f3fc; font-size:11px; margin-right:4px; }
    .pane { display:none; }
    .pane.on { display:block; animation:fade .2s ease; }
    @keyframes fade { from { opacity:0; transform:translateY(4px);} to { opacity:1; transform:none;} }
    .flow-wrap { background:#0b1020; border-radius:18px; padding:18px; border:1px solid var(--line); overflow:auto; }
    .flow { display:flex; flex-direction:column; gap:10px; }
    .flow .node { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:12px; background:rgba(124,58,237,.16); border:1px solid rgba(124,58,237,.4); }
    .flow .arrow { text-align:center; color:var(--muted); font-size:18px; }
    .tryit { display:grid; grid-template-columns:1.1fr .9fr; gap:16px; }
    @media (max-width:1100px) { .tryit { grid-template-columns:1fr; } }
    .tryit form { display:flex; flex-direction:column; gap:12px; }
    .tryit label { display:flex; flex-direction:column; gap:6px; font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; }
    .tryit input, .tryit textarea, .tryit select { background:rgba(8,11,18,.65); color:var(--text); border:1px solid var(--line); border-radius:10px; padding:10px 12px; font:13px/1.5 'JetBrains Mono', monospace; outline:none; transition:border-color .18s ease; }
    .tryit input:focus, .tryit textarea:focus, .tryit select:focus { border-color:rgba(124,58,237,.6); box-shadow:0 0 0 3px rgba(124,58,237,.18); }
    .tryit textarea { min-height:120px; resize:vertical; }
    .tryit .group { border:1px solid var(--line); border-radius:12px; padding:12px; background:rgba(255,255,255,.02); }
    .tryit .group h4 { margin:0 0 10px; font-size:12px; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); }
    .field-row { display:grid; grid-template-columns:1fr 1fr 1.4fr auto auto; gap:8px; align-items:center; margin-bottom:6px; }
    .field-row input, .field-row select { padding:8px 10px; }
    .field-row .req { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--muted); text-transform:none; letter-spacing:0; white-space:nowrap; }
    .field-row .rm { background:transparent; color:var(--err); border:1px solid rgba(239,68,68,.3); border-radius:8px; padding:6px 9px; cursor:pointer; font-size:12px; }
    .field-row .rm:hover { background:rgba(239,68,68,.12); }
    .send { appearance:none; background:linear-gradient(135deg,#7c3aed,#22d3ee); color:#070912; border:0; border-radius:12px; padding:12px 16px; font-weight:700; cursor:pointer; box-shadow:0 14px 30px rgba(124,58,237,.35); transition:transform .18s ease, box-shadow .18s ease; }
    .send:hover { transform:translateY(-1px); box-shadow:0 18px 36px rgba(124,58,237,.45); }
    .send:disabled { opacity:.5; cursor:not-allowed; transform:none; }
    .response { background:#0b1020; border:1px solid var(--line); border-radius:14px; padding:14px; min-height:200px; max-height:520px; overflow:auto; }
    .response .meta { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
    .response .meta .badge { font-size:11px; }
    .response pre { margin:0; }
    .endpoint-selector { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; }
    .endpoint-selector button { appearance:none; background:rgba(255,255,255,.04); color:var(--text); border:1px solid var(--line); border-radius:10px; padding:8px 12px; cursor:pointer; font-size:12px; font-weight:600; }
    .endpoint-selector button:hover { border-color:rgba(124,58,237,.4); }
    .endpoint-selector button.on { background:linear-gradient(135deg, #c4b5fd, #67e8f9); color:#070912; border-color:transparent; }
    .tag-bar { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px; align-items:center; }
    .tag-bar input { background:rgba(8,11,18,.65); color:var(--text); border:1px solid var(--line); border-radius:10px; padding:8px 12px; font:13px 'Inter',sans-serif; outline:none; min-width:200px; }
    .tag-bar input:focus { border-color:rgba(124,58,237,.6); }
    .tag-btn { appearance:none; background:rgba(34,211,238,.14); color:#a5f3fc; border:1px solid rgba(34,211,238,.3); border-radius:999px; padding:4px 12px; cursor:pointer; font-size:11px; font-weight:600; }
    .tag-btn:hover { background:rgba(34,211,238,.24); }
    .tag-btn.on { background:#22d3ee; color:#070912; }
    .endpoint-tag { display:inline-block; padding:2px 8px; border-radius:6px; background:rgba(34,211,238,.16); color:#a5f3fc; font-size:10px; margin-left:6px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; }
    .endpoint.hidden { display:none; }
    .pill { display:inline-flex; align-items:center; gap:6px; padding:3px 9px; border-radius:999px; background:rgba(255,255,255,.06); border:1px solid var(--line); color:var(--muted); font-size:11px; }
    .pill .dot { width:6px; height:6px; border-radius:50%; background:var(--ok); }
    .pill .dot.warn { background:var(--warn); }
    .pill .dot.err { background:var(--err); }
  </style>
</head>
<body>
  <div class="err" id="errbox"></div>
  <div class="app">
    <aside>
      <div class="brand">
        <div class="logo"></div>
        <div>
          <h1>OpenSpec</h1>
          <p>${escapeHtml(api.title)}</p>
        </div>
      </div>
      <h2>Endpoints</h2>
      <nav class="endpoint-list" id="sidebar">
        ${api.endpoints.map((endpoint, index) => `<a href="#endpoint-${index}" data-jump="${index}" onclick="return jumpTo(event, ${index})"><span class="badge method ${endpoint.method}">${endpoint.method}</span> <span>${escapeHtml(endpoint.title)}</span></a>`).join("\n")}
      </nav>
    </aside>
    <main>
      <div class="topbar">
        <div>
          <h1>${escapeHtml(api.title)}</h1>
          <p>${escapeHtml(api.description ?? "AI-ready API documentation dashboard.")}</p>
          <p style="margin-top:6px;"><code>${escapeHtml(api.servers[0] ?? "")}</code> · v${escapeHtml(api.version)}</p>
        </div>
        <div class="tabs" id="tabs">
          <button type="button" class="on" onclick="return showTab('overview', this)">Overview</button>
          <button type="button" onclick="return showTab('endpoints', this)">Endpoints</button>
          <button type="button" onclick="return showTab('flow', this)">Flow</button>
          <button type="button" onclick="return showTab('tryit', this)">Try It</button>
        </div>
      </div>

      <section class="pane on" data-pane="overview">
        <div class="grid grid-3">
          <div class="panel stat"><span class="num">${api.endpoints.length}</span><span class="label">Endpoints</span></div>
          <div class="panel stat"><span class="num">${api.endpoints.filter((endpoint) => endpoint.body?.kind === "formData").length}</span><span class="label">Form-data APIs</span></div>
          <div class="panel stat"><span class="num">${api.endpoints.reduce((total, endpoint) => total + endpoint.conditions.length, 0)}</span><span class="label">Conditions</span></div>
        </div>
        <div class="grid grid-2" style="margin-top:16px;">
          <div class="panel">
            <h3 class="section-title">Quick Start</h3>
            <pre>curl -X GET "${escapeHtml(api.servers[0] ?? "")}/" \\
  -H "Authorization: Bearer &lt;token&gt;"</pre>
            <p class="pill"><span class="dot"></span> Replace &lt;token&gt; with your real token.</p>
          </div>
          <div class="panel">
            <h3 class="section-title">Endpoint Map</h3>
            ${api.endpoints.map((endpoint) => `<div style="display:flex; gap:10px; align-items:center; padding:6px 0; border-bottom:1px dashed var(--line);"><span class="badge method ${endpoint.method}">${endpoint.method}</span> <code>${escapeHtml(endpoint.path)}</code><span style="margin-left:auto; color:var(--muted);">${escapeHtml(endpoint.title)}</span></div>`).join("")}
          </div>
        </div>
      </section>

      <section class="pane" data-pane="endpoints" id="pane-endpoints">
        <div class="tag-bar">
          <input type="text" id="search-input" placeholder="Search endpoints, fields, paths..." oninput="return doSearch(this.value)">
          <button type="button" class="tag-btn on" onclick="return filterByTag('', this)">All</button>
          ${tagsHtml}
        </div>
        ${api.endpoints.map(endpointPanel).join("\n")}
      </section>

      <section class="pane" data-pane="flow">
        <div class="panel">
          <h3 class="section-title">API Flow</h3>
          <div class="flow-wrap">
            <div class="flow">
              ${renderFlow(api.endpoints)}
            </div>
          </div>
        </div>
        <div class="grid grid-2" style="margin-top:16px;">
          ${api.endpoints.map((endpoint) => `<div class="panel"><h3 class="section-title">${escapeHtml(endpoint.title)}</h3><p>${escapeHtml(endpoint.flow ?? "No flow defined.")}</p>${endpoint.dependsOn.length ? `<p><strong>Depends on:</strong> ${endpoint.dependsOn.map(escapeHtml).join(", ")}</p>` : ""}${endpoint.conditions.length ? `<h4 style="margin-top:10px; font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted);">Conditions</h4><ul style="margin:6px 0 0 18px; padding:0;">${endpoint.conditions.map((condition) => `<li>${escapeHtml(condition)}</li>`).join("")}</ul>` : ""}</div>`).join("")}
        </div>
      </section>

      <section class="pane" data-pane="tryit">
        <div class="panel">
          <h3 class="section-title">Select Endpoint</h3>
          <div class="endpoint-selector" id="endpoint-selector">
            ${api.endpoints.map((endpoint, index) => `<button type="button" data-index="${index}" class="${index === 0 ? "on" : ""}" onclick="return pickEndpoint(event, ${index})"><span class="badge method ${endpoint.method}">${endpoint.method}</span> ${escapeHtml(endpoint.path)}</button>`).join("")}
          </div>
          <div class="tryit">
            <form id="tryit-form" onsubmit="return submitTry(event)"></form>
            <div>
              <h3 class="section-title">Response</h3>
              <div class="response" id="response"><div class="pill"><span class="dot warn"></span> No request sent yet.</div></div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
  <script>
  window.addEventListener('error', function (e) {
    var box = document.getElementById('errbox');
    if (box) { box.style.display = 'block'; box.textContent = 'OpenSpec error: ' + (e.message || e.error); }
  });

  var ENDPOINTS = ${endpointsJson};
  var BASE = ${JSON.stringify(api.servers[0] ?? "")};
  var activeIndex = 0;

  function showTab(name, btn) {
    var tabs = document.querySelectorAll('#tabs button');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('on');
    var panes = document.querySelectorAll('.pane');
    for (var j = 0; j < panes.length; j++) panes[j].classList.remove('on');
    if (btn) btn.classList.add('on');
    var pane = document.querySelector('.pane[data-pane="' + name + '"]');
    if (pane) pane.classList.add('on');
    try { window.scrollTo(0, 0); } catch (e) {}
    return false;
  }

  function jumpTo(event, index) {
    if (event && event.preventDefault) event.preventDefault();
    var tabs = document.querySelectorAll('#tabs button');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('on');
    var panes = document.querySelectorAll('.pane');
    for (var j = 0; j < panes.length; j++) panes[j].classList.remove('on');
    var ep = document.querySelectorAll('#tabs button')[1];
    if (ep) ep.classList.add('on');
    var pane = document.querySelector('.pane[data-pane="endpoints"]');
    if (pane) pane.classList.add('on');
    var target = document.getElementById('endpoint-' + index);
    if (target) setTimeout(function () { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
    return false;
  }

  function pickEndpoint(event, index) {
    if (event && event.preventDefault) event.preventDefault();
    renderForm(index);
    return false;
  }

  function buildExample(fields) {
    var obj = {};
    (fields || []).forEach(function (f) {
      if (f.type === 'integer') obj[f.name] = 1;
      else if (f.type === 'number') obj[f.name] = 1.5;
      else if (f.type === 'boolean') obj[f.name] = true;
      else if (f.type === 'object') obj[f.name] = {};
      else if (f.type === 'array') obj[f.name] = [];
      else if (f.type === 'email') obj[f.name] = 'user@example.com';
      else if (f.type === 'file') obj[f.name] = null;
      else obj[f.name] = f.name + '_value';
    });
    return obj;
  }

  function fieldRow(field) {
    var wrapper = document.createElement('div');
    wrapper.className = 'field-row';
    var name = document.createElement('input'); name.value = field.name; name.placeholder = 'name';
    var type = document.createElement('select');
    ['string','integer','number','boolean','email','file'].forEach(function (opt) {
      var o = document.createElement('option'); o.value = opt; o.textContent = opt;
      if (opt === field.type) o.selected = true; type.appendChild(o);
    });
    var value = document.createElement('input');
    value.placeholder = field.type === 'file' ? 'choose file' : 'value';
    if (field.type === 'file') value.type = 'file';
    var req = document.createElement('label'); req.className = 'req';
    var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!field.required;
    req.appendChild(cb); req.appendChild(document.createTextNode('required'));
    var rm = document.createElement('button'); rm.type = 'button'; rm.className = 'rm'; rm.textContent = '×';
    rm.onclick = function () { wrapper.parentNode && wrapper.parentNode.removeChild(wrapper); };
    wrapper.appendChild(name); wrapper.appendChild(type); wrapper.appendChild(value); wrapper.appendChild(req); wrapper.appendChild(rm);
    return wrapper;
  }

  function readRowValue(row) {
    var nameInput = row.querySelector('input[placeholder="name"]');
    var inputs = row.querySelectorAll('input');
    var valueInput = inputs[inputs.length - 1];
    var select = row.querySelector('select');
    var checkbox = row.querySelector('input[type="checkbox"]');
    return {
      name: nameInput ? nameInput.value : '',
      type: select ? select.value : 'string',
      value: valueInput ? (valueInput.type === 'file' ? valueInput.files[0] : valueInput.value) : '',
      required: checkbox ? checkbox.checked : false
    };
  }

  function renderForm(index) {
    if (!ENDPOINTS[index]) return;
    activeIndex = index;
    var selBtns = document.querySelectorAll('#endpoint-selector button');
    for (var i = 0; i < selBtns.length; i++) selBtns[i].classList.toggle('on', Number(selBtns[i].getAttribute('data-index')) === index);
    var form = document.getElementById('tryit-form');
    if (!form) return;
    form.innerHTML = '';
    var endpoint = ENDPOINTS[index];
    var meta = document.createElement('div');
    meta.innerHTML = '<span class="badge method ' + endpoint.method + '">' + endpoint.method + '</span> <code>' + esc(endpoint.path) + '</code>';
    form.appendChild(meta);

    var urlGroup = document.createElement('div'); urlGroup.className = 'group';
    urlGroup.innerHTML = '<h4>Request</h4>';
    var serverLabel = document.createElement('label'); serverLabel.textContent = 'Server';
    var serverInput = document.createElement('input'); serverInput.value = BASE; serverInput.id = 'server';
    serverLabel.appendChild(serverInput);
    var pathLabel = document.createElement('label'); pathLabel.textContent = 'Path';
    var pathInput = document.createElement('input'); pathInput.value = endpoint.path; pathInput.id = 'path';
    pathLabel.appendChild(pathInput);
    urlGroup.appendChild(serverLabel); urlGroup.appendChild(pathLabel);
    form.appendChild(urlGroup);

    var groups = [
      { key: 'pathParams', title: 'Path Params' },
      { key: 'queryParams', title: 'Query Params' },
      { key: 'headers', title: 'Headers' }
    ];
    groups.forEach(function (g) {
      if (!endpoint[g.key] || !endpoint[g.key].length) return;
      var group = document.createElement('div'); group.className = 'group';
      group.innerHTML = '<h4>' + g.title + '</h4>';
      endpoint[g.key].forEach(function (f) { group.appendChild(fieldRow(f)); });
      form.appendChild(group);
    });

    if (endpoint.body) {
      var group = document.createElement('div'); group.className = 'group';
      var title = endpoint.body.kind === 'formData' ? 'Form Data Body' : (endpoint.body.kind === 'urlEncoded' ? 'URL-Encoded Body' : 'JSON Body');
      group.innerHTML = '<h4>' + title + '</h4>';
      if (endpoint.body.kind === 'json') {
        var area = document.createElement('textarea'); area.id = 'json-body';
        area.placeholder = '{\\n  "key": "value"\\n}';
        try { area.value = JSON.stringify(buildExample(endpoint.body.fields), null, 2); } catch (e) {}
        group.appendChild(area);
      } else {
        (endpoint.body.fields || []).forEach(function (f) { group.appendChild(fieldRow(f)); });
      }
      form.appendChild(group);
    }

    var send = document.createElement('button'); send.type = 'submit'; send.className = 'send'; send.textContent = 'Send Request';
    form.appendChild(send);
  }

  function applyPathParams(pathTemplate, rows) {
    var next = pathTemplate;
    rows.forEach(function (row) {
      var data = readRowValue(row);
      if (data.name) next = next.replace('{' + data.name + '}', encodeURIComponent(data.value == null ? '' : data.value));
    });
    return next;
  }

  function submitTry(event) {
    if (event && event.preventDefault) event.preventDefault();
    var endpoint = ENDPOINTS[activeIndex];
    if (!endpoint) return false;
    var responseBox = document.getElementById('response');
    if (!responseBox) return false;
    responseBox.innerHTML = '<div class="pill"><span class="dot warn"></span> Sending request...</div>';
    var serverEl = document.getElementById('server');
    var pathEl = document.getElementById('path');
    var server = serverEl ? serverEl.value.replace(/\\/$/, '') : BASE;
    var pathTemplate = pathEl ? pathEl.value : endpoint.path;
    var form = document.getElementById('tryit-form');
    var groupEls = form.querySelectorAll('.group');
    var init = { method: endpoint.method, headers: {} };
    var finalPath = pathTemplate;
    var query = '';
    var formData = new FormData();

    groupEls.forEach(function (group) {
      var h4 = group.querySelector('h4');
      var title = h4 ? h4.textContent : '';
      var rows = group.querySelectorAll('.field-row');
      if (title === 'Path Params') finalPath = applyPathParams(pathTemplate, rows);
      if (title === 'Query Params') {
        var params = [];
        rows.forEach(function (row) {
          var data = readRowValue(row);
          if (data.name) params.push(encodeURIComponent(data.name) + '=' + encodeURIComponent(data.value == null ? '' : data.value));
        });
        if (params.length) query = '?' + params.join('&');
      }
      if (title === 'Headers') {
        rows.forEach(function (row) {
          var data = readRowValue(row);
          if (data.name) init.headers[data.name] = data.value == null ? '' : data.value;
        });
      }
      if (title === 'JSON Body') {
        var area = group.querySelector('textarea');
        if (area && area.value.trim()) init.body = area.value;
        init.headers['Content-Type'] = 'application/json';
      }
      if (title === 'Form Data Body' || title === 'URL-Encoded Body') {
        var isForm = title === 'Form Data Body';
        rows.forEach(function (row) {
          var data = readRowValue(row);
          if (data.name) {
            if (isForm) formData.append(data.name, data.value == null ? '' : data.value);
            else init.body = new URLSearchParams({ [data.name]: data.value == null ? '' : data.value }).toString();
          }
        });
        if (isForm) init.body = formData;
      }
    });

    var url = server + finalPath + query;
    var started = (window.performance && performance.now) ? performance.now() : Date.now();
    fetch(url, init).then(function (res) {
      return res.text().then(function (text) { return { res: res, text: text }; });
    }).then(function (pair) {
      var ms = Math.round(((window.performance && performance.now) ? performance.now() : Date.now()) - started);
      var body = pair.text;
      try { body = JSON.stringify(JSON.parse(pair.text), null, 2); } catch (e) {}
      var dotClass = pair.res.ok ? '' : (pair.res.status >= 500 ? 'err' : 'warn');
      responseBox.innerHTML = '<div class="meta"><span class="pill"><span class="dot ' + dotClass + '"></span> ' + pair.res.status + ' ' + pair.res.statusText + '</span><span class="pill">' + ms + ' ms</span><span class="pill">' + endpoint.method + ' ' + esc(finalPath + query) + '</span></div><pre>' + esc(body) + '</pre>';
    }).catch(function (err) {
      responseBox.innerHTML = '<div class="meta"><span class="pill"><span class="dot err"></span> Network error</span></div><pre>' + esc((err && err.message) || String(err)) + '</pre>';
    });
    return false;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  (function () {
    var hash = (window.location.hash || '').replace('#', '');
    var m = hash.match(/^endpoint-(\\d+)$/);
    if (m) {
      var idx = parseInt(m[1], 10);
      if (!isNaN(idx)) {
        var tabs = document.querySelectorAll('#tabs button');
        for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('on');
        var panes = document.querySelectorAll('.pane');
        for (var j = 0; j < panes.length; j++) panes[j].classList.remove('on');
        if (tabs[1]) tabs[1].classList.add('on');
        var pane = document.querySelector('.pane[data-pane="endpoints"]');
        if (pane) pane.classList.add('on');
        var target = document.getElementById('endpoint-' + idx);
        if (target) setTimeout(function () { target.scrollIntoView({ behavior: 'auto', block: 'start' }); }, 50);
      }
    }
    renderForm(0);
  })();

  var currentFilter = '';
  function doSearch(q) {
    currentFilter = (q || '').toLowerCase();
    applyFilter();
    return false;
  }
  function filterByTag(tag, btn) {
    var btns = document.querySelectorAll('.tag-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('on');
    if (btn) btn.classList.add('on');
    var tagFilter = tag || '';
    var tagInputs = document.querySelectorAll('.endpoint');
    tagInputs.forEach(function (el) {
      var tags = (el.getAttribute('data-endpoint-tags') || '').split(',');
      var search = el.getAttribute('data-search') || '';
      var tagMatch = !tagFilter || tags.indexOf(tagFilter) >= 0;
      var searchMatch = !currentFilter || search.indexOf(currentFilter) >= 0;
      el.classList.toggle('hidden', !(tagMatch && searchMatch));
    });
    return false;
  }
  function applyFilter() {
    var btns = document.querySelectorAll('.tag-btn');
    var activeTag = '';
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].classList.contains('on') && btns[i].textContent !== 'All') { activeTag = btns[i].textContent; break; }
    }
    var tagInputs = document.querySelectorAll('.endpoint');
    tagInputs.forEach(function (el) {
      var tags = (el.getAttribute('data-endpoint-tags') || '').split(',');
      var search = el.getAttribute('data-search') || '';
      var tagMatch = !activeTag || tags.indexOf(activeTag) >= 0;
      var searchMatch = !currentFilter || search.indexOf(currentFilter) >= 0;
      el.classList.toggle('hidden', !(tagMatch && searchMatch));
    });
  }
  </script>
</body>
</html>`;
}

function renderFlow(endpoints: EndpointSpec[]): string {
  const parts: string[] = [];
  const edges = new Map<number, number[]>();
  endpoints.forEach((endpoint, index) => {
    endpoint.dependsOn.forEach((dependency) => {
      const depIndex = endpoints.findIndex((item) => item.title === dependency || `${item.method} ${item.path}` === dependency || item.path === dependency);
      if (depIndex >= 0) {
        if (!edges.has(depIndex)) edges.set(depIndex, []);
        edges.get(depIndex)!.push(index);
      }
    });
  });

  const inDegree = new Array(endpoints.length).fill(0);
  edges.forEach((targets) => targets.forEach((target) => inDegree[target]++));
  const visited = new Array(endpoints.length).fill(false);

  function visit(index: number) {
    if (visited[index]) return;
    visited[index] = true;
    parts.push(`<div class="node"><span class="badge method ${endpoints[index].method}">${endpoints[index].method}</span> <code>${escapeHtml(endpoints[index].path)}</code><span style="margin-left:auto;color:var(--muted);">${escapeHtml(endpoints[index].title)}</span></div>`);
    const targets = edges.get(index) || [];
    targets.forEach((target) => {
      if (!visited[target]) {
        parts.push(`<div class="arrow">↓</div>`);
        visit(target);
      }
    });
  }

  for (let i = 0; i < endpoints.length; i++) {
    if (inDegree[i] === 0) visit(i);
  }
  for (let i = 0; i < endpoints.length; i++) {
    if (!visited[i]) visit(i);
  }
  return parts.join("\n");
}

function endpointPanel(endpoint: EndpointSpec, index: number): string {
  const tagsHtml = endpoint.tags.map((t) => `<span class="endpoint-tag">${escapeHtml(t)}</span>`).join("");
  return `<article id="endpoint-${index}" class="endpoint" data-endpoint-tags="${escapeHtml(endpoint.tags.join(","))}" data-search="${escapeHtml(`${endpoint.title} ${endpoint.path} ${endpoint.method} ${endpoint.description ?? ""} ${endpoint.tags.join(" ")}`.toLowerCase())}">
    <header>
      <span class="badge method ${endpoint.method}">${endpoint.method}</span>
      <code>${escapeHtml(endpoint.path)}</code>
      <h3>${escapeHtml(endpoint.title)}</h3>
      ${tagsHtml}
    </header>
    <p>${escapeHtml(endpoint.description ?? "No description provided.")}</p>
    ${endpoint.auth ? `<p><span class="tag">auth</span> ${escapeHtml(endpoint.auth)}</p>` : ""}
    ${endpoint.dependsOn.length ? `<p><span class="tag">depends</span> ${endpoint.dependsOn.map(escapeHtml).join(", ")}</p>` : ""}
    ${endpoint.flow ? `<p><span class="tag">flow</span> ${escapeHtml(endpoint.flow)}</p>` : ""}
    ${endpoint.conditions.length ? `<details><summary style="cursor:pointer; color:var(--muted); margin:6px 0;">Conditions (${endpoint.conditions.length})</summary><ul style="margin:6px 0 0 18px;">${endpoint.conditions.map((condition) => `<li>${escapeHtml(condition)}</li>`).join("")}</ul></details>` : ""}
    ${table("Path Params", endpoint.pathParams)}
    ${table("Query Params", endpoint.queryParams)}
    ${table("Headers", endpoint.headers)}
    ${endpoint.body ? table(endpoint.body.kind === "formData" ? "Form Data Body" : "Request Body", endpoint.body.fields) : ""}
    ${endpoint.responses.map((response) => table(`${response.name} ${response.status}`, response.fields)).join("")}
  </article>`;
}

function table(title: string, fields: FieldSpec[]): string {
  if (fields.length === 0) return "";
  return `<h4 style="margin:12px 0 6px; font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted);">${escapeHtml(title)}</h4><table><thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Validation</th><th>Description</th></tr></thead><tbody>${fields.map((field) => `<tr><td><code>${escapeHtml(field.name)}</code></td><td>${escapeHtml(field.type)}</td><td>${field.required ? "yes" : "no"}</td><td>${escapeHtml(validationText(field))}</td><td>${escapeHtml(field.description ?? "-")}</td></tr>`).join("")}</tbody></table>`;
}

function validationText(field: FieldSpec): string {
  return Object.entries(field.validation).map(([key, value]) => `${key}=${value}`).join(", ") || "-";
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
