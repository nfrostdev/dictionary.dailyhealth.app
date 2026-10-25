import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pron import count_syllables, respell, syllables  # noqa: E402

AGRI = '/ˈæɡ.ɹɪˌkʌl.t͡ʃɚ/'


class RespellTest(unittest.TestCase):
    def test_agriculture(self):
        self.assertEqual(respell(AGRI), 'AG-rih-kul-cher')

    def test_hello(self):
        self.assertEqual(respell('/hɛˈloʊ/'), 'heh-LOH')
        self.assertEqual(respell('/ˈhɛ.loʊ/'), 'HEH-loh')

    def test_dotless(self):
        self.assertEqual(respell('/sɛpˈtɛmbɚ/'), 'sep-TEM-ber')

    def test_checked_vowel_borrows_coda(self):
        self.assertEqual(respell('/ˈɛləfənt/'), 'EL-uh-funt')

    def test_single_syllable_uppercase(self):
        self.assertEqual(respell('/kæt/'), 'KAT')

    def test_unknown_symbol(self):
        self.assertIsNone(respell('/ˈxɔx/'))

    def test_rhotic_before_vowel(self):
        self.assertEqual(respell('/ˈvɛ.ɹi/'), 'VEH-ree')
        self.assertEqual(respell('/ˈkɑɹ/'), 'KAR')

    def test_eye_only_without_onset(self):
        self.assertEqual(respell('/ˈdaɪ.nəˌsɔɹ/'), 'DY-nuh-sor')
        self.assertEqual(respell('/aɪ/'), 'EYE')
        self.assertEqual(respell('/ɹaɪt/'), 'RITE')

    def test_closed_ai(self):
        for ipa, want in (('/aɪs/', 'ICE'), ('/taɪm/', 'TIME'), ('/naɪs/', 'NICE'),
                          ('/waɪz/', 'WIZE'), ('/t͡ʃaɪld/', 'CHYLD'), ('/paɪnt/', 'PYNT')):
            self.assertEqual(respell(ipa), want)

    def test_parentheses_kept_contents(self):
        self.assertEqual(respell('/ˈsɛn.(t)ʃ(ə.)ɹi/'), 'SEN-chuh-ree')

    def test_schwa_r_before_boundary(self):
        self.assertEqual(respell('/ˈbʌ.tə(ɹ).flaɪ/'), 'BUH-ter-fly')

    def test_no_stress_multi(self):
        self.assertIsNone(respell('/sɛp.tɛm/'))


class CountTest(unittest.TestCase):
    def test_counts(self):
        self.assertEqual(count_syllables(AGRI), 4)
        self.assertEqual(count_syllables('/ˈeɪ.bl̩/'), 2)
        self.assertEqual(count_syllables('/aɪ/'), 1)
        self.assertIsNone(count_syllables('/ˈxɔx/'))


class SyllablesTest(unittest.TestCase):
    def test_wiktionary_parts(self):
        self.assertEqual(syllables('agriculture', AGRI, ['ag', 'ri', 'cul', 'ture']), 'ag·ri·cul·ture')

    def test_pyphen_fallback(self):
        self.assertEqual(syllables('september', '/sɛpˈtɛmbɚ/', None), 'sep·tem·ber')

    def test_count_mismatch_omitted(self):
        self.assertIsNone(syllables('elephant', '/ˈɛləfənt/', None))

    def test_one_syllable_omitted(self):
        self.assertIsNone(syllables('cat', '/kæt/', None))

    def test_bad_parts_rejected(self):
        self.assertIsNone(syllables('elephant', '/ˈɛl.ə.fənt/', ['el', 'e', 'phan']))


class RhoticAndBritishTest(unittest.TestCase):
    def test_ear_vowels(self):
        for ipa, want in (('/wɛɚ/', 'WAIR'), ('/jɪɚ/', 'YEER'), ('/hɛɚ/', 'HAIR'),
                          ('/ˈpjʊɚ/', 'PYOOR'), ('/kəmˈpɛɚ/', 'kum-PAIR')):
            self.assertEqual(respell(ipa), want)

    def test_british_sounds_dropped(self):
        for ipa in ('/ˈhəʊl.dɪŋ/', '/ˈsɛə/', '/ˈʃɪə/', '/ˈt͡ʃeə̯nəl/'):
            self.assertIsNone(respell(ipa))
        self.assertEqual(respell('/ˈhɛəɹ/'), 'HAIR')

    def test_unmarked_syllabic_r(self):
        self.assertEqual(respell('/ˈjɛstɹdeɪ/'), 'YES-ter-day')

    def test_t_theta(self):
        self.assertEqual(respell('/eɪtθ/'), 'AYTH')
        self.assertEqual(respell('/wɪtθ/'), 'WITH')

    def test_silent_e_only_for_one_letter_coda(self):
        self.assertEqual(respell('/laɪŋ/'), 'LYNG')
        self.assertEqual(respell('/laɪʃ/'), 'LYSH')
        self.assertEqual(respell('/taɪm/'), 'TIME')


class SyllablePlausibilityTest(unittest.TestCase):
    def test_no_t_ion_split(self):
        self.assertNotEqual(syllables('condition', '/kənˈdɪʃən/', ['con', 'dit', 'ion']), 'con·dit·ion')

    def test_vowelless_part_rejected(self):
        self.assertIsNone(syllables('rhythm', '/ˈɹɪ.ðəm/', ['rhy', 'thm']))

    def test_pyphen_first(self):
        self.assertEqual(syllables('computer', '/kəmˈpjutɚ/', ['comp', 'u', 'ter']), 'com·put·er')


if __name__ == '__main__':
    unittest.main()
