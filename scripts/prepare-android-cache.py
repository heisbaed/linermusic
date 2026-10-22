"""Expose existing Gradle artifacts as a workspace-local Maven repository."""
from pathlib import Path
import os
import shutil

root = Path(__file__).resolve().parents[1]
source = Path.home() / '.gradle/caches/modules-2/files-2.1'
destination = root / '.maven-offline'
count = 0
for group in source.iterdir():
    if not group.is_dir():
        continue
    for module in group.iterdir():
        if not module.is_dir():
            continue
        for version in module.iterdir():
            if not version.is_dir():
                continue
            target = destination.joinpath(*group.name.split('.'), module.name, version.name)
            for artifact in version.glob('*/*'):
                if not artifact.is_file():
                    continue
                target.mkdir(parents=True, exist_ok=True)
                output = target / artifact.name
                if not output.exists():
                    try:
                        os.link(artifact, output)
                    except OSError:
                        shutil.copyfile(artifact, output)
                    count += 1
print(f'Prepared {count} local Maven artifacts.')
