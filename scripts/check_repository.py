"""Validate repository text and mockup syntax without package dependencies."""
import argparse
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]


def lint():
    errors = []
    paths = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=ROOT).decode().split('\0')
    paths += ['scripts/check_repository.py']
    for name in sorted(set(filter(None, paths))):
        path = ROOT / name
        if not path.is_file():
            continue
        text = path.read_text()
        if text and not text.endswith('\n'):
            errors.append(f'{name}: missing final newline')
        if path.suffix == '.md' or name in {'.gitignore', '.claudeignore', '.copilotignore'}:
            if re.search(r'\{\{.*?\}\}|OPTIONAL|TEMPLATE NOTE', text):
                errors.append(f'{name}: unresolved template marker')
        if path.suffix == '.md':
            for target in re.findall(r'\[[^\]]*\]\(([^\s)]+)\)', text):
                if target.startswith(('#', 'http:', 'https:', 'mailto:')):
                    continue
                local = unquote(target.split('#')[0])
                if local and not (path.parent / local).exists():
                    errors.append(f'{name}: missing link target {target}')
    if errors:
        raise SystemExit('\n'.join(errors))
    print('Repository text checks passed.')


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.current = None
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            attrs = dict(attrs)
            if 'src' not in attrs and attrs.get('type', '') in ('', 'text/javascript', 'module'):
                self.current = []

    def handle_data(self, data):
        if self.current is not None:
            self.current.append(data)

    def handle_endtag(self, tag):
        if tag == 'script' and self.current is not None:
            self.scripts.append(''.join(self.current))
            self.current = None


def mockup():
    parser = Scripts()
    parser.feed((ROOT / 'docs/_planning/v1.0-gui-mockup.html').read_text())
    if not parser.scripts:
        raise SystemExit('No inline scripts found.')
    with tempfile.TemporaryDirectory() as directory:
        for index, script in enumerate(parser.scripts):
            path = Path(directory) / f'script-{index}.mjs'
            path.write_text(script)
            subprocess.run(['node', '--check', str(path)], check=True)
    print(f'Mockup syntax checks passed ({len(parser.scripts)} inline scripts).')


if __name__ == '__main__':
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('check', choices=['lint', 'mockup'])
    args = cli.parse_args()
    {'lint': lint, 'mockup': mockup}[args.check]()
