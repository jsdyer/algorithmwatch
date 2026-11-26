const id = name => document.getElementById(name);
const make = (tag, text, css = '') => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (css) el.className = css;
  return el;
};
const strip = text => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
const english = organization => organization.split(' / ')[0];
const link = (url, text) => {
  const element = make('a', text);
  element.href = url;
  return element;
};
const roman = ['', 'I', 'II', 'III', 'IV'];
const perPage = 14;
const filters = ['query', 'organization', 'status', 'personal', 'impact'];
let records = [];
let results = [];
let catalogue = '';
let page = 0;
let selection;

function show(record, focus = false) {
  selection = record;
  const detail = id('detail');
  if (!record) {
    history.replaceState(null, '', location.pathname + location.search);
    detail.replaceChildren(make('p', 'No systems match the current filters.', 'muted'));
    return;
  }
  history.replaceState(null, '', '#' + encodeURIComponent(record.id));
  const fields = [
    ['Reported status', record.status], ['Status date in register', record.statusDate],
    ['Primary users', record.users], ['Developed by', record.developer], ['Vendor', record.vendor],
    ['Personal information involved', record.personal || 'Not reported'],
    ['Users notified of AI', record.notice || 'Not reported'], ['Personal Information Banks', record.banks],
  ];
  const list = make('dl');
  for (const [label, value] of fields) {
    if (value) list.append(make('dt', label), make('dd', value));
  }
  detail.replaceChildren(make('p', record.id, 'meta'), make('h2', record.name),
    make('p', english(record.organization), 'meta'), list);
  for (const [title, value] of [['Description', record.description], ['Capabilities', record.capabilities],
    ['Data sources', record.sources], ['Reported results', record.results]]) {
    if (value) {
      const block = make('section', undefined, 'data-block');
      block.append(make('h3', title), make('p', value));
      detail.append(block);
    }
  }
  const assessment = make('section', undefined, 'data-block');
  assessment.append(make('h3', 'Published assessment'));
  if (record.assessment) {
    assessment.append(make('p', 'Reported impact level ' + roman[record.assessment.level], 'pill'));
    const paths = make('p');
    paths.append(link(record.assessment.record, 'Assessment and attachments'), ' · ',
      link(record.assessment.evidence, 'Official assessment PDF'));
    assessment.append(paths);
  } else {
    assessment.append(make('p', 'No verified assessment is linked for this register entry. Its impact level is unknown in this tool.', 'muted'));
  }
  detail.append(assessment, make('hr'), link(catalogue, 'Official register source'));
  if (focus) detail.focus();
}

function render() {
  const list = id('results');
  list.replaceChildren();
  for (const record of results.slice(page * perPage, (page + 1) * perPage)) {
    const button = make('button', record.name, 'result');
    button.type = 'button';
    button.setAttribute('aria-current', String(record === selection));
    button.append(make('span', [english(record.organization), record.status, record.assessment && `Level ${roman[record.assessment.level]}`].filter(Boolean).join(' · ')));
    button.addEventListener('click', () => {
      show(record, matchMedia('(max-width: 760px)').matches);
      for (const item of list.querySelectorAll('button')) item.setAttribute('aria-current', String(item === button));
    });
    const item = make('li');
    item.append(button);
    list.append(item);
  }
  const pages = Math.ceil(results.length / perPage);
  id('previous').disabled = page === 0;
  id('next').disabled = page + 1 >= pages;
  id('page').textContent = pages ? `Page ${page + 1} / ${pages}` : 'No matches';
  id('count').textContent = results.length.toLocaleString();
  id('export').disabled = !results.length;
}

function search(preferred = selection) {
  const words = strip(id('query').value).trim().split(/\s+/).filter(Boolean);
  const organization = id('organization').value;
  const status = id('status').value;
  const personal = id('personal').value;
  const impact = id('impact').value;
  results = records.filter(record => {
    const level = record.assessment?.level;
    return (!organization || english(record.organization) === organization)
      && (!status || (record.status || 'Not reported') === status)
      && (!personal || (record.personal || 'unknown') === personal)
      && (!impact || impact === String(level) || impact === (level ? 'linked' : 'unknown'))
      && words.every(word => record.search.includes(word));
  });
  const match = results.indexOf(preferred);
  page = match < 0 ? 0 : Math.floor(match / perPage);
  show(results[match < 0 ? 0 : match]);
  id('message').textContent = `${results.length.toLocaleString()} of ${records.length.toLocaleString()} systems · ${results.filter(record => record.assessment).length} with a verified assessment link`;
  render();
}

const csv = value => {
  const cell = String(value ?? '');
  const safe = /^[\t\r\n]|^\s*[=+@-]/.test(cell) ? "'" + cell : cell;
  return '"' + safe.replace(/"/g, '""') + '"';
};
id('export').addEventListener('click', () => {
  const fields = ['id', 'name', 'organization', 'status', 'statusDate', 'personal', 'notice', 'vendor'];
  const header = [...fields, 'verified_impact_level', 'assessment_url', 'register_source'].map(csv).join(',');
  const lines = results.map(record => [...fields.map(key => record[key]), record.assessment?.level,
    record.assessment?.record, catalogue].map(csv).join(','));
  const url = URL.createObjectURL(new Blob([[header, ...lines].join('\r\n')], {type: 'text/csv;charset=utf-8'}));
  const item = link(url, '');
  item.download = 'algorithm-watch.csv';
  item.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
for (const name of filters) id(name).addEventListener('input', () => search());
id('assessed').addEventListener('click', () => {
  for (const name of filters) id(name).value = '';
  id('impact').value = 'linked';
  search(null);
  id('results-label').focus();
});
id('reset').addEventListener('click', () => {
  for (const name of filters) id(name).value = '';
  search(null);
  id('query').focus();
});
id('previous').addEventListener('click', () => { page--; render(); });
id('next').addEventListener('click', () => { page++; render(); });

try {
  const response = await fetch('./register.json');
  if (!response.ok) throw Error('Unable to load register');
  const data = await response.json();
  catalogue = data.catalogue;
  records = data.records.map(record => ({...record, search: strip(Object.values(record).filter(value => typeof value === 'string').join(' '))}));
  records.sort((a, b) => a.name.localeCompare(b.name, 'en-CA'));
  for (const [select, options] of [['organization', records.map(record => english(record.organization))],
    ['status', records.map(record => record.status || 'Not reported')]]) {
    for (const option of [...new Set(options)].filter(Boolean).sort()) id(select).append(new Option(option, option));
  }
  id('source-date').textContent += (data.updated ? ` · source updated ${data.updated}` : '') + ` · index built ${data.built}`;
  id('controls').disabled = false;
  let initial;
  try { initial = decodeURIComponent(location.hash.slice(1)); } catch { /* Malformed URL */ }
  search(records.find(record => record.id === initial));
} catch {
  id('message').textContent = 'The register could not be loaded. Reload to retry, or use the official source linked below.';
}
