"""Test HRA hierarchy classification and GLB accessor decoding."""

import importlib.util
from pathlib import Path
import struct
import unittest


spec = importlib.util.spec_from_file_location("convert_female", Path(__file__).with_name("convert-female.py"))
converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(converter)


class FemaleConverterTests(unittest.TestCase):
    """Check classification exceptions and binary layout handling."""

    def test_system_suffix_in_structure_name(self):
        self.assertEqual(converter.classify([
            "trachea", "VH_F_trachea_of_respiratory_system", "VH_F_respiratory_system",
        ]), "respiratory")

    def test_specialized_systems(self):
        for names, expected in [
            (["VH_F_placenta", "VH_F_reproductive_system"], "pregnancy"),
            (["VH_F_vein", "VH_F_circulatory_system"], "venous"),
            (["VH_F_heart", "VH_F_circulatory_system"], "cardiac"),
            (["VH_F_aorta", "VH_F_circulatory_system"], "arterial"),
            (["VH_F_eye", "VH_F_nervous_system"], "sensory"),
        ]:
            with self.subTest(names=names):
                self.assertEqual(converter.classify(names), expected)
        with self.assertRaises(ValueError):
            converter.classify(["unknown"])

    def test_interleaved_accessor(self):
        binary = struct.pack("<8f", 1, 2, 3, 99, 4, 5, 6, 99)
        doc = {
            "accessors": [{"bufferView": 0, "componentType": 5126, "type": "VEC3", "count": 2}],
            "bufferViews": [{"byteLength": len(binary), "byteStride": 16}],
        }
        self.assertEqual(list(converter.read_accessor(doc, binary, 0, len(binary), 0)), [1, 2, 3, 4, 5, 6])
        doc["bufferViews"][0]["byteLength"] = 20
        with self.assertRaises(ValueError):
            converter.read_accessor(doc, binary, 0, len(binary), 0)

    def test_invalid_glb(self):
        with self.assertRaises(ValueError):
            converter.read_document(struct.pack("<4sII", b"nope", 2, 12))


if __name__ == "__main__":
    unittest.main()
