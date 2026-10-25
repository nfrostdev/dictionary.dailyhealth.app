import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from build import ipa_candidates, keep_sense, merge  # noqa: E402

SENSES = [{'d': 'x'}]


def part(rank, order, ipa, display='word'):
    return (rank, order, display, ipa, 'noun', SENSES, None)


class MergePronunciationTest(unittest.TestCase):
    def test_only_first_part_speaks(self):
        rec = merge('write', [part(0, 0, '/ˈxɔx/'), part(0, 1, '/ɹaɪt/')])
        self.assertNotIn('say', rec)

    def test_first_part_without_ipa_gives_nothing(self):
        rec = merge('polish', [part(0, 0, None), part(1, 1, '/ˈpoʊ.lɪʃ/', 'Polish')])
        self.assertNotIn('say', rec)
        self.assertNotIn('s', rec)

    def test_required_word_uses_proper_noun_part(self):
        rec = merge('canada', [part(0, 0, '/ˈkɑ.nə.də/', 'canada'), part(2, 1, '/ˈkæn.ə.də/', 'Canada')])
        self.assertEqual(rec['say'], 'KAN-uh-duh')


class KeepSenseTest(unittest.TestCase):
    def sense(self, **extra):
        return {'glosses': ['A thing.'], **extra}

    def test_plain_sense_kept(self):
        self.assertTrue(keep_sense(self.sense(categories=[{'name': 'Birdwatching'}]), 'owl', 'noun'))

    def test_internet_tag_kept(self):
        self.assertTrue(keep_sense({'glosses': ['A website that consists of entries.'], 'tags': ['Internet']}, 'blog', 'noun'))

    def test_page_level_slur_category_kept(self):
        self.assertTrue(keep_sense(self.sense(categories=[{'name': 'English religious slurs'}]), 'peaceful', 'adj'))

    def test_alternative_form_of_porn_dropped(self):
        self.assertFalse(keep_sense({'glosses': ['Alternative form of porn star.']}, 'x', 'noun'))


class CandidateTest(unittest.TestCase):
    def sounds(self, *rows):
        return {'sounds': [{k: v for k, v in zip(('ipa', 'tags', 'note'), r) if v} for r in rows]}

    def test_weak_notes_skipped(self):
        e = self.sounds(('/ʃəl/', None, 'weak form'), ('/ʃæl/', None, 'strong form'))
        self.assertEqual(ipa_candidates(e), ['/ʃæl/'])

    def test_strong_note_counts_untagged(self):
        e = self.sounds(('/biː/', None, 'stressed form'), ('/bi/', None, 'Dublin'))
        self.assertEqual(ipa_candidates(e), ['/biː/'])

    def test_british_rejected_and_length_marks_last(self):
        e = self.sounds(('/pɑːs/', ['US'], None), ('/ˈhəʊl/', ['US'], None),
                        ('/pæːs/', ['US'], None), ('/pæs/', ['US'], None))
        self.assertEqual(ipa_candidates(e), ['/pæs/', '/pæːs/'])


if __name__ == '__main__':
    unittest.main()
