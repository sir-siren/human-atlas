"""Convert official BodyParts3D 4.0 OBJ meshes without altering topology.

Geometry is converted from millimetres/Z-up into metres/Y-up, normals are packed
as signed 16-bit integers, and parts are grouped into size-bounded binary chunks
alongside an ``atlas.json`` manifest.

Source and attribution: ``public/ATTRIBUTION.md``.

Usage::

    python3 scripts/convert-anatomy.py OBJ_DIRECTORY CONCEPT_MAP [SYSTEM_MAP]
"""

from __future__ import annotations

import argparse
import json
import sys
from array import array
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Final

# --- Coordinate conversion -------------------------------------------------
# BodyParts3D ships millimetres in a Z-up frame. The scene expects metres in a
# Y-up frame with the model centred on the origin, hence the two offsets below.
MM_TO_M: Final = 0.001
HEIGHT_OFFSET_M: Final = 0.0781112
DEPTH_OFFSET_M: Final = -0.1

# Signed 16-bit normal encoding. 32767 rather than 32768 so that +1.0 and -1.0
# round-trip symmetrically.
NORMAL_SCALE: Final = 32767

# Soft cap on a chunk before rotating to the next file. Checked between parts,
# so a single large part may push a chunk past this.
CHUNK_BYTE_LIMIT: Final = 7_000_000

# Every typed array in the blob starts on a 4-byte boundary so the browser can
# create views over it without copying.
ALIGNMENT: Final = 4

DEFAULT_SYSTEM: Final = "connective"
ENGLISH_NAME_PREFIX: Final = "# English name : "

MANIFEST_NAME: Final = "atlas.json"
OUTPUT_SUBDIR: Final = "public/models/female"
CONCEPT_FIELDS: Final = frozenset({"id", "name", "elements"})


class ConversionError(RuntimeError):
    """Raised when source data is missing, malformed, or internally inconsistent."""


@dataclass(slots=True)
class Mesh:
    """A single decoded OBJ mesh in engine coordinates."""

    name: str
    positions: list[float] = field(default_factory=list)
    normals: list[int] = field(default_factory=list)
    indices: list[int] = field(default_factory=list)

    @property
    def vertex_count(self) -> int:
        return len(self.positions) // 3

    @property
    def index_count(self) -> int:
        return len(self.indices)

    def bounds(self) -> list[list[float]]:
        """Return ``[[min_x, min_y, min_z], [max_x, max_y, max_z]]``."""
        axes = [self.positions[axis::3] for axis in range(3)]
        return [[min(a) for a in axes], [max(a) for a in axes]]

    def validate(self, element_id: str) -> None:
        if not self.positions:
            msg = f"{element_id}: mesh has no vertices"
            raise ConversionError(msg)
        if len(self.normals) != len(self.positions):
            msg = (
                f"{element_id}: expected one normal per vertex, got "
                f"{len(self.normals) // 3} normals for {self.vertex_count} vertices"
            )
            raise ConversionError(msg)
        if not self.indices:
            msg = f"{element_id}: mesh has no faces"
            raise ConversionError(msg)
        if max(self.indices) >= self.vertex_count:
            msg = (
                f"{element_id}: index {max(self.indices)} is out of range for "
                f"{self.vertex_count} vertices"
            )
            raise ConversionError(msg)


class ChunkWriter:
    """Accumulates typed arrays into aligned binary chunks on disk."""

    def __init__(self, directory: Path, byte_limit: int = CHUNK_BYTE_LIMIT) -> None:
        self._directory = directory
        self._byte_limit = byte_limit
        self._buffer = bytearray()
        self._index = 0
        self._chunks: list[dict[str, Any]] = []

    @property
    def index(self) -> int:
        """Index of the chunk currently being written to."""
        return self._index

    @property
    def chunks(self) -> list[dict[str, Any]]:
        return self._chunks

    def rotate_if_full(self) -> None:
        """Flush and start a new chunk if the current one is over the limit."""
        if len(self._buffer) > self._byte_limit:
            self._flush()
            self._buffer = bytearray()
            self._index += 1

    def append(self, values: list[float] | list[int], typecode: str) -> int:
        """Append ``values`` as a typed array and return its byte offset."""
        padding = -len(self._buffer) % ALIGNMENT
        self._buffer.extend(bytes(padding))
        offset = len(self._buffer)
        self._buffer.extend(array(typecode, values).tobytes())
        return offset

    def close(self) -> list[dict[str, Any]]:
        """Flush the final chunk and return the chunk manifest entries."""
        self._flush()
        return self._chunks

    def _flush(self) -> None:
        name = f"anatomy-{self._index}.bin"
        (self._directory / name).write_bytes(self._buffer)
        self._chunks.append({"url": f"/models/female/{name}", "bytes": len(self._buffer)})


def parse_obj(path: Path, fallback_name: str) -> Mesh:
    """Decode an OBJ file into engine coordinates.

    Positions are converted to metres and Y-up. Normals are packed to signed
    16-bit. Polygons are triangulated with a fan, which is safe here because
    BodyParts3D faces are convex.
    """
    try:
        text = path.read_text()
    except OSError as error:
        msg = f"cannot read {path}: {error}"
        raise ConversionError(msg) from error

    mesh = Mesh(name=fallback_name)

    for line in text.splitlines():
        if line.startswith(ENGLISH_NAME_PREFIX):
            mesh.name = line.split(" : ", 1)[1].strip() or fallback_name
        elif line.startswith("v "):
            x, y, z = (float(v) for v in line.split()[1:4])
            mesh.positions.extend(
                (
                    x * MM_TO_M,
                    z * MM_TO_M + HEIGHT_OFFSET_M,
                    -y * MM_TO_M + DEPTH_OFFSET_M,
                )
            )
        elif line.startswith("vn "):
            x, y, z = (float(v) for v in line.split()[1:4])
            mesh.normals.extend((_pack_normal(x), _pack_normal(z), _pack_normal(-y)))
        elif line.startswith("f "):
            face = [int(token.split("/")[0]) - 1 for token in line.split()[1:]]
            for corner in range(1, len(face) - 1):
                mesh.indices.extend((face[0], face[corner], face[corner + 1]))

    return mesh


def _pack_normal(value: float) -> int:
    """Quantise a normal component to signed 16-bit, clamped to avoid overflow."""
    return max(-NORMAL_SCALE, min(NORMAL_SCALE, round(value * NORMAL_SCALE)))


def load_system_index(system_data: Any) -> dict[str, Any]:
    """Normalise the many shapes the system map arrives in into ``id -> record``."""
    if not isinstance(system_data, dict):
        return {}

    for key in ("systems", "mapping", "elements", "meshes"):
        if key in system_data:
            index = system_data[key]
            break
    else:
        index = system_data

    if isinstance(index, list):
        return {entry["id"]: entry for entry in index if "id" in entry}
    if isinstance(index, dict):
        return index
    return {}


def resolve_system(entry: Any) -> str:
    """Pull a system name out of a plain string or a record."""
    if isinstance(entry, str):
        return entry
    if isinstance(entry, dict):
        return entry.get("system") or entry.get("category") or DEFAULT_SYSTEM
    return DEFAULT_SYSTEM


def convert(
    obj_dir: Path,
    metadata: dict[str, Any],
    system_data: dict[str, Any],
    out_dir: Path,
) -> dict[str, Any]:
    """Convert every element in ``metadata`` and return the atlas manifest."""
    system_index = load_system_index(system_data)
    overrides = system_data.get("parts", {}) if isinstance(system_data, dict) else {}

    writer = ChunkWriter(out_dir)
    parts: list[dict[str, Any]] = []
    total_triangles = 0

    for element in metadata["elements"]:
        element_id = element["id"]
        mesh = parse_obj(obj_dir / f"{element_id}.obj", element["name"])
        mesh.validate(element_id)

        writer.rotate_if_full()
        positions_offset = writer.append(mesh.positions, "f")
        normals_offset = writer.append(mesh.normals, "h")
        indices_offset = writer.append(mesh.indices, "I")

        override = overrides.get(element_id, {})
        parts.append(
            {
                "id": element_id,
                "name": override.get("name", mesh.name),
                "conceptId": override.get("conceptId", element["conceptId"]),
                "system": resolve_system(system_index.get(element_id, DEFAULT_SYSTEM)),
                "chunk": writer.index,
                "positions": positions_offset,
                "normals": normals_offset,
                "indices": indices_offset,
                "vertexCount": mesh.vertex_count,
                "indexCount": mesh.index_count,
                "bounds": mesh.bounds(),
            }
        )
        total_triangles += mesh.index_count // 3

    chunks = writer.close()
    concepts = [
        {k: v for k, v in concept.items() if k in CONCEPT_FIELDS}
        for concept in metadata["concepts"]
    ]

    return {
        "version": "BodyParts3D 4.0",
        "parts": parts,
        "chunks": chunks,
        "triangles": total_triangles,
        "concepts": concepts,
    }


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text())
    except OSError as error:
        msg = f"cannot read {path}: {error}"
        raise ConversionError(msg) from error
    except json.JSONDecodeError as error:
        msg = f"{path} is not valid JSON: {error}"
        raise ConversionError(msg) from error


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("obj_dir", type=Path, help="directory of BodyParts3D .obj files")
    parser.add_argument("concept_map", type=Path, help="JSON file of concepts/elements")
    parser.add_argument(
        "system_map",
        type=Path,
        nargs="?",
        help="optional JSON file mapping element ids to anatomical systems",
    )
    parser.add_argument(
        "-o",
        "--out",
        type=Path,
        default=None,
        help=f"output directory (default: <repo>/{OUTPUT_SUBDIR})",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    repo_root = Path(__file__).resolve().parents[1]
    out_dir = args.out or repo_root / OUTPUT_SUBDIR
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        metadata = read_json(args.concept_map)
        system_data = read_json(args.system_map) if args.system_map else {}
        manifest = convert(args.obj_dir, metadata, system_data, out_dir)
    except ConversionError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    (out_dir / MANIFEST_NAME).write_text(
        json.dumps(manifest, separators=(",", ":"))
    )

    summary = {
        "parts": len(manifest["parts"]),
        "concepts": len(manifest["concepts"]),
        "triangles": manifest["triangles"],
        "bytes": sum(chunk["bytes"] for chunk in manifest["chunks"]),
        "chunks": len(manifest["chunks"]),
        "systems": sorted({part["system"] for part in manifest["parts"]}),
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
