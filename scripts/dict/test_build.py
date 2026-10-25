import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from build import merge  # noqa: E402

SENSES = [{'d': 'x'}]


def part(rank, order, ipa, display='word'):
    return (rank, order, display, ipa, 'noun', SENSES, None)


class MergePronunciationTest(unittest.TestCase):
    def test_same_rank_prefers_respellable(self):
        rec = merge('write', [part(0, 0, '/ˈxɔx/'), part(0, 1, '/ɹaɪt/')])
        self.assertEqual(rec['say'], 'RITE')

    def test_higher_rank_never_overrides(self):
        rec = merge('polish', [part(0, 0, '/ˈxɔx/'), part(1, 1, '/ˈpoʊ.lɪʃ/', 'Polish')])
        self.assertNotIn('say', rec)


if __name__ == '__main__':
    unittest.main()
