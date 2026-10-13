"""GitHub Actions-only upstream merge/release coordinator. No production credentials."""
import argparse
import base64
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.error import HTTPError
from urllib.request import Request, urlopen

REPO = 'haipengTian/sub2api'
UPSTREAM = 'Wei-Shaw/sub2api'
STATE_BRANCH = 'codex/custom-sync-state'
STATE_PATH = 'custom-sync.json'
VERSION_FILE = 'backend/cmd/server/VERSION'
STABLE = re.compile(r'v(\d+)\.(\d+)\.(\d+)')


def git(root, *args):
    return subprocess.check_output(['git', *args], cwd=root, text=True).strip()


def merge_candidate(root, official, version):
    """Only VERSION is generated locally; all other conflicts block publication."""
    result = subprocess.run(['git', 'merge', '--no-ff', '--no-commit', official], cwd=root)
    conflicts = git(root, 'diff', '--name-only', '--diff-filter=U').splitlines()
    blocked = [path for path in conflicts if path != VERSION_FILE]
    if not blocked and (not result.returncode or conflicts):
        # The repository token cannot authorize arbitrary new workflow definitions.
        # Keep these changes for a maintainer rather than losing the status to a rejected push.
        blocked = git(root, 'diff', 'HEAD', '--name-only', '--', '.github/workflows').splitlines()
    if blocked or (result.returncode and not conflicts):
        if (Path(git(root, 'rev-parse', '--absolute-git-dir')) / 'MERGE_HEAD').exists():
            git(root, 'merge', '--abort')
        if blocked:
            return blocked
        raise subprocess.CalledProcessError(result.returncode, result.args)
    (Path(root) / VERSION_FILE).write_text(version + '\n', encoding='utf-8')
    git(root, 'add', VERSION_FILE)
    git(root, 'commit', '-m', f'chore(custom): merge upstream for {version}')
    return []


def next_tag(upstream, tags):
    if not STABLE.fullmatch(upstream):
        raise ValueError('automatic sync accepts stable upstream vX.Y.Z tags only')
    pattern = re.compile(re.escape(upstream) + r'-custom\.(\d+)')
    revisions = [int(m[1]) for tag in tags if (m := pattern.fullmatch(tag))]
    return f'{upstream}-custom.{max(revisions, default=0) + 1}'


def api(path, method='GET', payload=None, missing=False):
    token = os.environ['GH_TOKEN']
    request = Request('https://api.github.com/' + path,
                      data=None if payload is None else json.dumps(payload).encode(),
                      method=method, headers={'Authorization': 'Bearer ' + token,
                      'Accept': 'application/vnd.github+json', 'User-Agent': 'Sub2API-custom-sync'})
    try:
        with urlopen(request, timeout=30) as response:
            body = response.read()
            return json.loads(body) if body else None
    except HTTPError as error:
        if missing and error.code == 404:
            return None
        raise


def load_state():
    content = api(f'repos/{REPO}/contents/{STATE_PATH}?ref={STATE_BRANCH}', missing=True)
    return (json.loads(base64.b64decode(content['content'])) if content else {}, content)


def save_state(state):
    _, existing = load_state()
    if existing is None:
        branch = api(f'repos/{REPO}/git/ref/heads/{STATE_BRANCH}', missing=True)
        if branch is None:
            main = api(f'repos/{REPO}/git/ref/heads/main')
            api(f'repos/{REPO}/git/refs', 'POST', {'ref': 'refs/heads/' + STATE_BRANCH,
                                                 'sha': main['object']['sha']})
    state['checked_at'] = datetime.now(timezone.utc).isoformat()
    state['run_id'] = os.environ['GITHUB_RUN_ID']
    state['run_url'] = f"https://github.com/{REPO}/actions/runs/{os.environ['GITHUB_RUN_ID']}"
    payload = {'message': 'chore(custom): record fusion status [skip ci]',
               'branch': STATE_BRANCH,
               'content': base64.b64encode((json.dumps(state, ensure_ascii=False, indent=2) + '\n').encode()).decode()}
    if existing:
        payload['sha'] = existing['sha']
    api(f'repos/{REPO}/contents/{STATE_PATH}', 'PUT', payload)


def outputs(**values):
    with Path(os.environ['GITHUB_OUTPUT']).open('a', encoding='utf-8') as output:
        for key, value in values.items():
            output.write(f'{key}={value}\n')


def prepare(root, retry=False):
    if git(root, 'status', '--porcelain'):
        raise RuntimeError('dirty checkout')
    release = api(f'repos/{UPSTREAM}/releases/latest')
    target = release['tag_name']
    if release['draft'] or release['prerelease'] or not STABLE.fullmatch(target):
        raise ValueError('not an official stable release')
    git(root, 'fetch', '--no-tags', 'origin', 'main')
    baseline = git(root, 'rev-parse', 'FETCH_HEAD^{commit}')
    git(root, 'switch', '--detach', baseline)
    current = (Path(root) / VERSION_FILE).read_text().strip()
    current_base = tuple(int(n) for n in current.split('-')[0].split('.'))
    target_base = tuple(int(n) for n in STABLE.fullmatch(target).groups())
    previous, _ = load_state()
    if target_base <= current_base:
        # Promotion may have succeeded while the subsequent publication failed.
        # A manual retry publishes that exact existing tag, never generates a new candidate.
        if (retry and previous.get('status') in ('checking', 'publishing', 'checks_failed', 'publish_failed')
                and previous.get('candidate_sha') == baseline
                and previous.get('tag') == 'v' + current):
            git(root, 'fetch', '--tags', 'origin')
            if git(root, 'rev-parse', previous['tag'] + '^{commit}') != baseline:
                raise RuntimeError('existing release tag does not match the validated candidate')
            previous['status'] = 'publishing'
            save_state(previous)
            outputs(ready='true', resume='true', sha=baseline, base=baseline, tag=previous['tag'])
            return
        outputs(ready='false')
        return
    git(root, 'fetch', '--no-tags', f'https://github.com/{UPSTREAM}.git', 'refs/tags/' + target)
    official = git(root, 'rev-parse', 'FETCH_HEAD^{commit}')
    if not retry and previous.get('base_sha') == baseline and previous.get('upstream_sha') == official:
        # No periodic retry loop for conflicts or failed checks. Manual retry remains possible.
        outputs(ready='false')
        return
    git(root, 'fetch', '--tags', 'origin')
    tag = next_tag(target, git(root, 'tag', '--list').splitlines())
    branch = f"codex/sync-{tag}-{os.environ['GITHUB_RUN_ID']}-{os.environ.get('GITHUB_RUN_ATTEMPT', '1')}"
    git(root, 'switch', '-c', branch, baseline)
    state = {'upstream_tag': target, 'upstream_sha': official, 'base_sha': baseline,
             'branch': branch, 'tag': tag, 'status': 'checking'}
    conflicts = merge_candidate(root, official, tag.removeprefix('v'))
    state['conflicts'] = conflicts
    if conflicts:
        # Conflict branch retains the personal baseline plus a report, never conflict-marker code.
        state['status'] = 'manual_review' if all(path.startswith('.github/workflows/') for path in conflicts) else 'conflict'
        report = Path(root) / 'docs/custom/syncs' / (tag + '-conflicts.json')
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')
        git(root, 'add', str(report.relative_to(root)))
        git(root, 'commit', '-m', f'chore(custom): record conflicts for {target}')
    candidate = git(root, 'rev-parse', 'HEAD')
    state['candidate_sha'] = candidate
    git(root, 'push', 'origin', f'HEAD:refs/heads/{branch}')
    save_state(state)
    outputs(ready=str(not conflicts).lower(), resume='false', sha=candidate, base=baseline, tag=tag, branch=branch)


def promote(root, baseline, candidate, tag):
    if not re.fullmatch(r'v\d+\.\d+\.\d+-custom\.[1-9]\d*', tag):
        raise ValueError('invalid custom tag')
    git(root, 'fetch', '--no-tags', 'origin', 'main')
    if git(root, 'rev-parse', 'FETCH_HEAD^{commit}') != baseline:
        raise RuntimeError('personal main advanced during validation; retry fusion on the new baseline')
    git(root, 'fetch', '--no-tags', 'origin', candidate)
    git(root, 'merge-base', '--is-ancestor', baseline, candidate)
    git(root, 'switch', '--detach', candidate)
    if (Path(root) / VERSION_FILE).read_text().strip() != tag.removeprefix('v'):
        raise ValueError('candidate VERSION mismatch')
    git(root, 'tag', '-a', tag, candidate, '-m', f'Sub2API custom release {tag}')
    # Reject concurrent main changes and existing tags; never force either ref.
    git(root, 'push', '--atomic', 'origin', f'{candidate}:refs/heads/main', f'refs/tags/{tag}')
    state, _ = load_state()
    state['status'] = 'publishing'
    save_state(state)


def finish(status):
    state, _ = load_state()
    if state and state.get('run_id') == os.environ['GITHUB_RUN_ID']:
        state['status'] = status
        save_state(state)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('stage', choices=['prepare', 'promote', 'finish'])
    parser.add_argument('--retry', action='store_true')
    parser.add_argument('--base')
    parser.add_argument('--sha')
    parser.add_argument('--tag')
    parser.add_argument('--status', choices=['published', 'checks_failed', 'publish_failed'])
    args = parser.parse_args()
    if os.environ.get('GITHUB_REPOSITORY') != REPO or os.environ.get('GITHUB_ACTIONS') != 'true':
        parser.error('only runs in the personal repository GitHub Actions')
    root = Path(git(Path.cwd(), 'rev-parse', '--show-toplevel'))
    git(root, 'config', 'user.name', 'github-actions[bot]')
    git(root, 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com')
    if args.stage == 'prepare':
        prepare(root, args.retry)
    elif args.stage == 'promote':
        promote(root, args.base, args.sha, args.tag)
    else:
        if not args.status:
            parser.error('--status required')
        finish(args.status)


if __name__ == '__main__':
    main()
