"""Run with python -B scripts/blender/test_reception_palette.py; no Blender needed."""
import ast
import copy
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]


def recipe_contract():
    tree = ast.parse((ROOT / "scripts/blender/author_reception.py").read_text())
    selected = [node for node in tree.body
                if isinstance(node, ast.FunctionDef) and node.name == "reception_material"]
    namespace = {}
    exec(compile(ast.Module(body=selected, type_ignores=[]), "recipe contract", "exec"), namespace)
    return namespace["reception_material"], tree


class ReceptionPaletteTests(unittest.TestCase):
    def test_approved_accent_assignments(self):
        resolve, _ = recipe_contract()
        for old, new in (("coral", "teal"), ("peach", "cream"), ("clay", "wood")):
            self.assertEqual(resolve("Coral counter crown", old), new)

    def test_floor_neutral_and_existing_cream_retained(self):
        resolve, _ = recipe_contract()
        self.assertEqual(resolve("Tile 0-0", "sand"), "pale")
        self.assertEqual(resolve("Tile 1-0", "cream"), "cream")
        self.assertEqual(resolve("Noticeboard inset", "sand"), "sand")

    def test_other_palette_assignments_unchanged(self):
        resolve, _ = recipe_contract()
        for color in ("cream", "pale", "sand", "wood", "butter", "teal", "sky",
                      "lime", "leaf", "deep", "lavender"):
            self.assertEqual(resolve("Unchanged prop", color), color)

    def test_palette_hex_identities_unchanged(self):
        _, tree = recipe_contract()
        palette = next(ast.literal_eval(node.value) for node in tree.body
                       if isinstance(node, ast.Assign)
                       and any(isinstance(t, ast.Name) and t.id == "PALETTE" for t in node.targets))
        self.assertEqual(palette, dict(cream="FFF0D8", pale="FFF9EB", sand="E9C99B",
            clay="C88D65", wood="AF7B52", coral="E66861", peach="F5B5AB", butter="F7D86B",
            teal="62CFC7", sky="A9E7F4", lime="A6D96A", leaf="65B96A", deep="3E8654",
            lavender="B5A7D6"))

    def test_author_mesh_uses_shared_resolver(self):
        _, tree = recipe_contract()
        author = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "Author")
        mesh = next(n for n in author.body if isinstance(n, ast.FunctionDef) and n.name == "mesh")
        self.assertTrue(any(isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
                            and n.func.id == "reception_material" for n in ast.walk(mesh)))


class ExportContractTests(unittest.TestCase):
    def comparator(self):
        path = ROOT / "scripts/blender/recolor_reception.py"
        tree = ast.parse(path.read_text() if path.exists() else "")
        selected = [n for n in tree.body if isinstance(n, ast.FunctionDef)
                    and n.name == "assert_geometry_equal"]
        namespace = {"copy": copy}
        exec(compile(ast.Module(body=selected, type_ignores=[]), "export contract", "exec"), namespace)
        return namespace["assert_geometry_equal"]

    def fixture(self):
        return {"nodes": [{"name": "room", "mesh": 0, "translation": [0, 0, 0]}],
                "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "material": 0}]}],
                "materials": [{"name": "old"}], "accessors": [{"count": 3}]}

    def test_material_only_json_is_allowed(self):
        before = self.fixture()
        after = copy.deepcopy(before)
        after["materials"] = [{"name": "new"}]
        after["meshes"][0]["primitives"][0]["material"] = 2
        self.comparator()(before, b"geometry", after, b"geometry")

    def test_geometry_node_and_binary_changes_rejected(self):
        check = self.comparator()
        before = self.fixture()
        for key in ("nodes", "accessors", "meshes"):
            after = copy.deepcopy(before)
            after[key] = []
            with self.assertRaises(ValueError):
                check(before, b"geometry", after, b"geometry")
        with self.assertRaises(ValueError):
            check(before, b"geometry", before, b"different")


if __name__ == "__main__":
    unittest.main()
