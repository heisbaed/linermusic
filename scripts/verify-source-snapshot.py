from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parents[1]
tree = json.loads((root / '.source-import/tree.json').read_text())
def blob_hash(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
verified = 0
mismatches = []
for entry in tree['tree']:
    if entry['type'] != 'blob' or entry['path'].startswith('.github/assets/'):
        continue
    file = root / entry['path']
    data = file.read_bytes()
    if blob_hash(data) != entry['sha'] and data.endswith(b'\n') and blob_hash(data[:-1]) == entry['sha']:
        file.write_bytes(data[:-1])
        data = data[:-1]
    if blob_hash(data) == entry['sha']:
        verified += 1
    else:
        mismatches.append(entry['path'])
print(json.dumps({'verified': verified, 'mismatches': mismatches}))
