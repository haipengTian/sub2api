import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('auto_release', Path(__file__).parents[1] / 'auto_release.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class GitFixture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.env = dict(os.environ, GIT_CONFIG_GLOBAL=os.devnull,
                        GIT_AUTHOR_NAME='Fixture', GIT_AUTHOR_EMAIL='fixture@example.com',
                        GIT_COMMITTER_NAME='Fixture', GIT_COMMITTER_EMAIL='fixture@example.com')
        self.git('init', '-q', '-b', 'main')
        (self.root / 'backend/cmd/server').mkdir(parents=True)
        self.write('backend/cmd/server/VERSION', '0.2.15\n')
        self.write('app.txt', 'base\n')
        self.commit('base')
        self.base = self.git('rev-parse', 'HEAD')
        self.git('switch', '-qc', 'upstream')
        self.write('backend/cmd/server/VERSION', '0.2.16\n')
        self.write('app.txt', 'official\n')
        self.commit('official')
        self.official = self.git('rev-parse', 'HEAD')
        self.git('switch', 'main')
        self.write('backend/cmd/server/VERSION', '0.2.15-custom.1\n')
        self.write('custom.txt', 'custom\n')
        self.commit('custom')
        self.personal = self.git('rev-parse', 'HEAD')

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root, env=self.env, text=True).strip()

    def write(self, path, text):
        (self.root / path).write_text(text)

    def commit(self, message):
        self.git('add', '.')
        self.git('commit', '-qm', message)

    def merge(self):
        with patch.dict(os.environ, self.env):
            return mod.merge_candidate(self.root, self.official, '0.2.16-custom.1')


class MergeTests(GitFixture):
    def test_version_only_conflict_keeps_custom_code_and_official_history(self):
        self.assertEqual(self.merge(), [])
        self.assertEqual((self.root / 'app.txt').read_text(), 'official\n')
        self.assertEqual((self.root / 'custom.txt').read_text(), 'custom\n')
        self.assertEqual((self.root / 'backend/cmd/server/VERSION').read_text(), '0.2.16-custom.1\n')
        self.git('merge-base', '--is-ancestor', self.official, 'HEAD')

    def test_code_conflict_leaves_original_commit_and_no_merge(self):
        self.write('app.txt', 'conflicting custom\n')
        self.commit('conflict')
        before = self.git('rev-parse', 'HEAD')
        self.assertEqual(self.merge(), ['app.txt'])
        self.assertEqual(self.git('rev-parse', 'HEAD'), before)
        self.assertEqual(self.git('status', '--porcelain'), '')

    def test_upstream_workflow_changes_need_manual_review(self):
        self.git('switch', 'upstream')
        (self.root / '.github/workflows').mkdir(parents=True)
        self.write('.github/workflows/ci.yml', 'name: changed workflow\n')
        self.commit('upstream workflow')
        self.official = self.git('rev-parse', 'HEAD')
        self.git('switch', 'main')
        self.assertEqual(self.merge(), ['.github/workflows/ci.yml'])
        self.assertEqual(self.git('status', '--porcelain'), '')
        self.assertEqual(self.git('rev-parse', 'HEAD'), self.personal)

    def test_non_conflict_merge_error_is_not_publishable(self):
        with patch.dict(os.environ, self.env):
            with self.assertRaises(subprocess.CalledProcessError):
                mod.merge_candidate(self.root, 'not-a-commit', '0.2.16-custom.1')

    def test_custom_revision_and_stable_version_selection(self):
        self.assertEqual(mod.next_tag('v0.2.16', ['v0.2.16-custom.1', 'v0.2.16-custom.9']), 'v0.2.16-custom.10')
        with self.assertRaises(ValueError):
            mod.next_tag('v0.2.16-rc.1', [])


class CoordinatorTests(GitFixture):
    def setUp(self):
        super().setUp()
        self.git('tag', 'v0.2.16', self.official)
        remote_temp = tempfile.TemporaryDirectory()
        self.addCleanup(remote_temp.cleanup)
        self.remote = Path(remote_temp.name) / 'origin.git'
        subprocess.check_call(['git', 'clone', '-q', '--bare', str(self.root), str(self.remote)], env=self.env)
        self.git('remote', 'add', 'origin', str(self.remote))
        environment = patch.dict(os.environ, dict(self.env, GITHUB_RUN_ID='123', GITHUB_RUN_ATTEMPT='1'))
        environment.start()
        self.addCleanup(environment.stop)
        real_git = mod.git

        def local_git(root, *args):
            if args[:3] == ('fetch', '--no-tags', f'https://github.com/{mod.UPSTREAM}.git'):
                args = ('fetch', '--no-tags', 'origin', args[3])
            return real_git(root, *args)

        for name, kwargs in {
            'git': {'side_effect': local_git},
            'api': {'return_value': {'tag_name': 'v0.2.16', 'draft': False, 'prerelease': False}},
            'load_state': {'return_value': ({}, None)},
            'save_state': {}, 'outputs': {},
        }.items():
            mocker = patch.object(mod, name, **kwargs)
            setattr(self, name + '_mock', mocker.start())
            self.addCleanup(mocker.stop)

    def remote_git(self, *args):
        return subprocess.check_output(['git', '--git-dir', str(self.remote), *args], env=self.env, text=True).strip()

    def test_conflict_pushes_report_branch_without_advancing_main_or_tagging(self):
        self.write('app.txt', 'conflicting custom\n')
        self.commit('conflict')
        before = self.git('rev-parse', 'HEAD')
        self.git('push', 'origin', 'main')
        mod.prepare(self.root)
        state = self.save_state_mock.call_args.args[0]
        self.assertEqual(state['status'], 'conflict')
        self.assertEqual(state['conflicts'], ['app.txt'])
        self.assertEqual(self.outputs_mock.call_args.kwargs['ready'], 'false')
        self.assertEqual(self.remote_git('rev-parse', 'main'), before)
        self.assertNotIn('v0.2.16-custom.1', self.remote_git('tag', '--list'))
        self.assertEqual(self.remote_git('show', state['branch'] + ':app.txt'), 'conflicting custom')

    def test_clean_prepare_creates_candidate_but_does_not_publish(self):
        mod.prepare(self.root)
        state = self.save_state_mock.call_args.args[0]
        self.assertEqual(state['status'], 'checking')
        self.assertEqual(self.outputs_mock.call_args.kwargs['ready'], 'true')
        self.assertEqual(self.remote_git('rev-parse', 'main'), self.personal)
        self.assertEqual(self.remote_git('show', state['branch'] + ':backend/cmd/server/VERSION'), '0.2.16-custom.1')
        self.assertNotIn('v0.2.16-custom.1', self.remote_git('tag', '--list'))

    def test_same_failed_candidate_is_skipped_until_explicit_retry(self):
        self.load_state_mock.return_value = ({'base_sha': self.personal, 'upstream_sha': self.official, 'status': 'checks_failed'}, None)
        mod.prepare(self.root)
        self.assertEqual(self.outputs_mock.call_args.kwargs['ready'], 'false')
        self.save_state_mock.assert_not_called()
        mod.prepare(self.root, retry=True)
        self.assertEqual(self.outputs_mock.call_args.kwargs['ready'], 'true')

    def test_promote_rejects_a_changed_main(self):
        self.assertEqual(self.merge(), [])
        candidate = self.git('rev-parse', 'HEAD')
        self.git('switch', '-qc', 'race', self.personal)
        self.write('custom.txt', 'a concurrent feature\n')
        self.commit('race')
        self.git('push', 'origin', 'HEAD:main')
        with self.assertRaisesRegex(RuntimeError, 'main advanced'):
            mod.promote(self.root, self.personal, candidate, 'v0.2.16-custom.1')
        self.assertNotIn('v0.2.16-custom.1', self.remote_git('tag', '--list'))

    def test_promote_moves_main_and_tag_to_the_validated_candidate(self):
        mod.prepare(self.root)
        candidate = self.outputs_mock.call_args.kwargs['sha']
        mod.promote(self.root, self.personal, candidate, 'v0.2.16-custom.1')
        self.assertEqual(self.remote_git('rev-parse', 'main'), candidate)
        self.assertEqual(self.remote_git('rev-parse', 'v0.2.16-custom.1^{commit}'), candidate)
        self.assertEqual(self.save_state_mock.call_args.args[0]['status'], 'publishing')

    def test_existing_remote_tag_rejects_atomic_main_promotion(self):
        mod.prepare(self.root)
        candidate = self.outputs_mock.call_args.kwargs['sha']
        self.remote_git('tag', 'v0.2.16-custom.1', self.personal)
        with self.assertRaises(subprocess.CalledProcessError):
            mod.promote(self.root, self.personal, candidate, 'v0.2.16-custom.1')
        self.assertEqual(self.remote_git('rev-parse', 'main'), self.personal)

    def test_finish_does_not_overwrite_another_runs_state(self):
        self.load_state_mock.return_value = ({'run_id': '456', 'status': 'checking'}, None)
        mod.finish('published')
        self.save_state_mock.assert_not_called()
        self.load_state_mock.return_value = ({'run_id': '123', 'status': 'publishing'}, None)
        mod.finish('published')
        self.assertEqual(self.save_state_mock.call_args.args[0]['status'], 'published')

    def test_manual_retry_resumes_failed_publication_of_the_existing_tag(self):
        mod.prepare(self.root)
        state = self.save_state_mock.call_args.args[0].copy()
        candidate = state['candidate_sha']
        mod.promote(self.root, self.personal, candidate, state['tag'])
        state['status'] = 'publish_failed'
        self.load_state_mock.return_value = (state, None)
        mod.prepare(self.root, retry=True)
        self.assertEqual(self.outputs_mock.call_args.kwargs['ready'], 'true')
        self.assertEqual(self.outputs_mock.call_args.kwargs['resume'], 'true')
        self.assertEqual(self.outputs_mock.call_args.kwargs['tag'], 'v0.2.16-custom.1')
        self.assertEqual(self.remote_git('tag', '--list', '*custom*'), 'v0.2.16-custom.1')


if __name__ == '__main__':
    unittest.main()
