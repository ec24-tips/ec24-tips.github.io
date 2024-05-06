#!/usr/bin/env python

import json, glob, re, unicodedata as u, sys

def validate(node, uids, filename):
    '''
    Soft validation of GeoJSON object and UID generation
    '''
    if type(node) != dict:
        raise ValueError(f'{filename}: Invalid GeoJSON Feature')
    typ = node.get('type')
    if typ == 'FeatureCollection':
        features = node.get('features')
        if type(features) != list:
            raise ValueError(f'{filename}: GeoJSON FeatureCollection has invalid feature list')
        for f in features:
            validate(f, uids, filename)
    elif typ == 'Feature':
        if not 'geometry' in node:
            raise ValueError(f'{filename}: GeoJSON Feature has no geometry')
        props = node.get('properties')
        if type(props) != dict:
            raise ValueError(f'{filename}: GeoJSON Feature has no properties')
        for field in ['name', 'description', 'category', 'tags']:
            if field not in props:
                raise ValueError(f'{filename}: Missing property `{field}` in GeoJSON object')
        if type(props['name']) != str:
            raise ValueError(f'{filename}: `name` must be a string')
        if type(props['description']) != str:
            raise ValueError(f'{filename}: `description` must be a string')
        if type(props['category']) != str:
            raise ValueError(f'{filename}: `category` must be a string')
        if type(props['tags']) != list:
            raise ValueError(f'{filename}: `tags` must be a list')
        if type(props.get('links', [])) != list:
            raise ValueError(f'{filename}: `links` must be a list')
        if type(props.get('recommenders', [])) != list:
            raise ValueError(f'{filename}: `recommenders` must be a list')
        if 'id' in node and node['id']:
            uid = node['id']
            if uid in uids:
                raise RuntimeError(f"{filename}: UID '{uid}' is already in the collection")
            uids.add(uid)
        else:
            uid = base = re.sub('[^a-z0-9]', '-',
                                u.normalize(
                                    'NFKD',
                                    props['name'].lower().strip()
                                ).encode('ascii', 'ignore').decode())
            count = 1
            while uid in uids:
                uid = f"{base}_{count}"
                count += 1
            node['id'] = uid
            uids.add(uid)
    else:
        raise ValueError(f'{filename}: GeoJSON object has invalide type.')

if __name__ == '__main__':
    features = {
        "type": "FeatureCollection",
        "features": [],
    }
    uids = set()
    
    for f in glob.glob('features/*.geojson'):
        collection = json.load(open(f))
        validate(collection, uids, f)
        collection['filename'] = f
        features['features'].append(collection)

    if len(sys.argv) > 1:
        if sys.argv[1] == '-':
            out = sys.stdout
        else:
            out = open(sys.argv[1], 'w')
    else:
        out = open('features.json', 'w')
        
    json.dump(features, out, ensure_ascii=False)
