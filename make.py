#!/usr/bin/env python

import json, glob, re, unicodedata as u

features = {
    "type": "FeatureCollection",
    "features": [],
}

uids = set()

def uidify(collection):
    for m in collection['features']:
        if 'properties' in m:
            if 'uid' in m['properties']:
                uid = m['properties']['uid']
                if uid in uids:
                    raise RuntimeError(f"UID '{uid}' is already in the collection")
                uids.add(uid)
            else:
                uid = base = re.sub('[^a-z0-9]', '-',
                                    u.normalize('NFKD',
                                                m['properties'].get('name', 'feature')
                                                .lower()
                                                .strip()
                                                ).encode('ascii', 'ignore')
                                    .decode())
                count = 1
                while uid in uids:
                    uid = f"{base}_{count}"
                    count += 1
                m['properties']['uid'] = uid
                uids.add(uid)
        if m['type'] == 'FeatureCollection':
            uidify(m)    

for f in glob.glob('features/*.geojson'):
    collection = json.load(open(f))
    collection['properties'] = { 'uid' : f }
    uidify(collection)
    features['features'].append(collection)

json.dump(features, open('features.json', 'w'), ensure_ascii=False)
