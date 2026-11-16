"""Build a static browser index from the federal AI Register CSV."""
import argparse
import csv
from datetime import date
import hashlib
import io
import json
from pathlib import Path
import shutil
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = 'fcbc0200-79ba-4fa4-94a6-00e32facea6b'
RESOURCE = '369f6f34-148a-42ed-b581-8c164e941a89'
CATALOGUE = f'https://open.canada.ca/data/dataset/{PACKAGE}'
CSV = f'{CATALOGUE}/resource/{RESOURCE}/download/gc-ai-register-mvp-registre-de-lia-du-gc-pmv-04-26.csv'
FIELDS = {
    'id': 'ai_register_id', 'name': 'name_ai_system_en', 'nameFr': 'name_ai_system_fr',
    'organization': 'government_organization', 'description': 'description_ai_system_en',
    'descriptionFr': 'description_ai_system_fr', 'users': 'ai_system_primary_users_en',
    'developer': 'developed_by_en', 'vendor': 'vendor_information', 'status': 'ai_system_status_en',
    'statusDate': 'status_date', 'capabilities': 'ai_system_capabilities_en', 'sources': 'data_sources_en',
    'personal': 'involves_personal_information', 'banks': 'personal_information_banks_en',
    'notice': 'notification_ai', 'results': 'ai_system_results_en',
}


def fetch(url, limit):
    request = Request(url, headers={'User-Agent': 'CoolCode Algorithm Watch public register build'})
    with urlopen(request, timeout=45) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError('Source exceeds expected size')
    return data


def register_source():
    try:
        meta = json.loads(fetch(f'https://open.canada.ca/data/api/action/package_show?id={PACKAGE}', 400000))
        resources = meta['result']['resources']
        entry = next(r for r in resources if r['id'] == RESOURCE and r.get('format', '').lower() == 'csv')
        url = entry['url']
        if urlsplit(url).scheme != 'https' or urlsplit(url).hostname != 'open.canada.ca':
            raise ValueError('Unexpected register download origin')
        return url, (entry.get('last_modified') or meta['result'].get('metadata_modified') or '')[:10]
    except (OSError, KeyError, ValueError, StopIteration) as error:
        print(f'Unable to discover latest resource ({error}); using the documented April 2026 resource')
        return CSV, '2026-04-28'


def normalize(text):
    return ' '.join(unicodedata.normalize('NFKC', text).casefold().split())


def generate(raw, source, updated):
    rows = csv.DictReader(io.StringIO(raw.decode('utf-8-sig'), newline=''))
    if not rows.fieldnames or not set(FIELDS.values()).issubset(rows.fieldnames):
        raise ValueError('Register CSV columns changed; verify the official schema before updating')
    curated = json.loads((ROOT / 'data' / 'assessments.json').read_text())
    records = []
    seen = set()
    matched = set()
    for row in rows:
        entry = {key: (row[column] or '').strip() for key, column in FIELDS.items()}
        if not entry['id'] or not entry['name']:
            continue
        if entry['id'] in seen:
            raise ValueError(f'Duplicate register ID: {entry["id"]}')
        seen.add(entry['id'])
        entry['status'] = entry['status'].lower().capitalize()
        for key in ('personal', 'notice'):
            entry[key] = {'Y': 'Yes', 'N': 'No'}.get(entry[key].upper(), '')
        assessment = curated.get(entry['id'])
        # Preserve an explicit reviewed join only whilst the official name and department match.
        if assessment and normalize(entry['name']) == normalize(assessment['title']) and entry['organization'].startswith(assessment['organization'] + ' /'):
            entry['assessment'] = {key: assessment[key] for key in ('level', 'record', 'evidence')}
            matched.add(entry['id'])
        records.append({key: value for key, value in entry.items() if value})
    if len(records) < 100:
        raise ValueError(f'Expected the federal register, found just {len(records)} populated records')
    if set(curated) - matched:
        print('Review no longer matching assessment IDs:', sorted(set(curated) - matched))
    return {
        'source': source, 'catalogue': CATALOGUE, 'updated': updated,
        'built': date.today().isoformat(), 'sha256': hashlib.sha256(raw).hexdigest(),
        'records': records,
    }


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--register', type=Path, help='Use a saved official CSV to reproduce a build')
    args = cli.parse_args()
    source, updated = (CSV, '') if args.register else register_source()
    raw = args.register.read_bytes() if args.register else fetch(source, 10000000)
    data = generate(raw, source, updated)
    dist = ROOT / 'dist'
    shutil.rmtree(dist, ignore_errors=True)
    shutil.copytree(ROOT / 'web', dist)
    (dist / 'register.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    (dist / '.nojekyll').touch()
    print(f'{len(data["records"])} register entries; {sum("assessment" in r for r in data["records"])} verified AIA joins')


if __name__ == '__main__':
    main()
