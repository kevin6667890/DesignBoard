import inspect
import unittest

from services.ai_service import analyze_pasted_job_page, language_instruction


class CareerLanguageInstructionTests(unittest.TestCase):
    def test_chinese_instruction_is_explicit(self):
        self.assertIn("MUST be written in Simplified Chinese", language_instruction("zh"))

    def test_english_instruction_is_explicit(self):
        self.assertIn("written in English", language_instruction("en"))

    def test_paste_job_prompt_uses_shared_instruction(self):
        self.assertIn("language_instruction(language)", inspect.getsource(analyze_pasted_job_page))


if __name__ == "__main__":
    unittest.main()
