"""Convert baked HRA united-female v1.5 GLB geometry into atlas chunks.

Read labels, ontology identifiers and system ancestry from the GLB itself.
Translate Y-up positions in metres into the atlas stage; quantize normals to
signed 16-bit values. Require Python 3 only; memory-map the source for low RAM use.
"""

import argparse
from array import array
import json
import math
import mmap
from pathlib import Path
import struct
import sys
import tempfile


STAGE_Y_SHIFT = 0.794760942
CHUNK_BYTES = 6_000_000
FORMATS = {5126: ("f", 4), 5125: ("I", 4), 5123: ("H", 2), 5121: ("B", 1)}
WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
SYSTEMS = {
    "integumentary", "nervous", "muscular", "reproductive", "digestive",
    "urinary", "circulatory", "respiratory", "lymphatic", "skeletal",
}


def read_document(source):
    """Read the JSON and binary offsets of a GLB 2 file; reject external buffers."""
    magic, version, length = struct.unpack_from("<4sII", source)
    if magic != b"glTF" or version != 2 or length != len(source):
        raise ValueError("Expected a complete GLB 2 file")
    size, kind = struct.unpack_from("<I4s", source, 12)
    if kind != b"JSON":
        raise ValueError("Expected a GLB JSON chunk")
    doc = json.loads(source[20:20 + size])
    binary_size, kind = struct.unpack_from("<I4s", source, 20 + size)
    start = 28 + size
    if kind != b"BIN\x00" or start + binary_size > len(source):
        raise ValueError("Expected an embedded GLB binary chunk")
    if len(doc["buffers"]) != 1 or "uri" in doc["buffers"][0]:
        raise ValueError("External buffers are unsupported")
    return doc, start, binary_size


def read_accessor(doc, source, start, binary_size, index):
    """Decode a dense accessor, including interleaved data, into a native array."""
    accessor = doc["accessors"][index]
    if "sparse" in accessor or accessor.get("normalized", False):
        raise ValueError("Sparse or normalized source accessors are unsupported")
    view = doc["bufferViews"][accessor["bufferView"]]
    fmt, size = FORMATS[accessor["componentType"]]
    width = WIDTHS[accessor["type"]]
    offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    stride = view.get("byteStride", width * size)
    count = accessor["count"]
    end = offset + (count - 1) * stride + width * size
    if (view.get("buffer", 0) != 0 or count <= 0 or stride < width * size
            or offset < 0 or end > binary_size
            or end > view.get("byteOffset", 0) + view["byteLength"]):
        raise ValueError("Accessor exceeds its buffer view")
    values = array(fmt)
    if stride == width * size:
        values.frombytes(source[start + offset:start + end])
        if sys.byteorder != "little":
            values.byteswap()
    else:
        for i in range(count):
            values.extend(struct.unpack_from("<" + fmt * width, source, start + offset + i * stride))
    return values


def classify(names):
    """Map HRA hierarchy names to display systems; reject unknown ancestry."""
    system = next((candidate for name in names
                   if (candidate := name.removeprefix("VH_F_").removesuffix("_system"))
                   in SYSTEMS), None)
    if system not in SYSTEMS:
        raise ValueError(f"Unknown anatomical system: {names}")
    context = " ".join(names).lower()
    if any(word in context for word in ("placenta", "umbilical_cord", "chorionic", "decidua")):
        return "pregnancy"
    if system == "circulatory":
        if any(word in context for word in ("vein", "venous", "vena_")):
            return "venous"
        return "cardiac" if "heart" in context else "arterial"
    if system == "nervous" and any(word in context for word in ("eye", "ear", "retina", "lens", "optic")):
        return "sensory"
    return system


def convert(source_path, output):
    """Write chunks and atlas.json for an aligned HRA source; reject transforms.

    Stage output before publishing so parsing failures leave existing assets intact.
    Emit raw chunks for the existing optimization and gzip pipeline.
    """
    output.mkdir(parents=True, exist_ok=True)
    with source_path.open("rb") as handle, mmap.mmap(handle.fileno(), 0, access=mmap.ACCESS_READ) as source, tempfile.TemporaryDirectory(dir=output.parent) as temporary:
        stage = Path(temporary)
        doc, start, binary_size = read_document(source)
        nodes = doc["nodes"]
        parents = {}
        for i, node in enumerate(nodes):
            if any(key in node for key in ("matrix", "translation", "rotation", "scale")):
                raise ValueError(f"Expected baked transforms: {node.get('name', i)}")
            for child in node.get("children", []):
                if child in parents:
                    raise ValueError("Expected a single-parent anatomical hierarchy")
                parents[child] = i
        chunks, parts, nodeparts = [], [], {}
        blob = bytearray()
        triangles = 0

        def flush():
            """Write the current aligned chunk and release its buffer."""
            if not blob:
                return
            filename = f"source-female-{len(chunks)}.bin"
            (stage / filename).write_bytes(blob)
            chunks.append({"url": f"/models/female/{filename}", "bytes": len(blob)})
            blob.clear()

        def append(values):
            """Append little-endian values at a four-byte-aligned offset."""
            blob.extend(b"\x00" * (-len(blob) % 4))
            offset = len(blob)
            if sys.byteorder != "little":
                values.byteswap()
            blob.extend(values.tobytes())
            return offset

        for ni, node in enumerate(nodes):
            if "mesh" not in node:
                continue
            extras = node.get("extras", {})
            name = extras.get("label") or node["name"].replace("VH_F_", "").replace("_", " ")
            ancestry, visited, current = [name], set(), ni
            while current is not None:
                if current in visited:
                    raise ValueError("Cyclic anatomical hierarchy")
                visited.add(current)
                ancestry.append(nodes[current]["name"])
                current = parents.get(current)
            system = classify(ancestry)
            positions, normals, indices = array("f"), array("h"), array("I")
            for primitive in doc["meshes"][node["mesh"]]["primitives"]:
                if primitive.get("mode", 4) != 4:
                    raise ValueError("Only triangle primitives are supported")
                pos = read_accessor(doc, source, start, binary_size, primitive["attributes"]["POSITION"])
                norm = read_accessor(doc, source, start, binary_size, primitive["attributes"]["NORMAL"])
                ind = read_accessor(doc, source, start, binary_size, primitive["indices"])
                if len(pos) % 3 or len(norm) != len(pos) or len(ind) % 3 or max(ind) >= len(pos) // 3:
                    raise ValueError(f"Invalid geometry: {node['name']}")
                if not all(math.isfinite(v) for values in (pos, norm) for v in values):
                    raise ValueError(f"Non-finite geometry: {node['name']}")
                base = len(positions) // 3
                for i in range(1, len(pos), 3):
                    pos[i] += STAGE_Y_SHIFT
                positions.extend(pos)
                normals.extend(max(-32767, min(32767, round(v * 32767))) for v in norm)
                indices.extend(i + base for i in ind)
            if not positions:
                raise ValueError(f"Empty mesh: {node['name']}")
            if len(blob) > CHUNK_BYTES:
                flush()
            bounds = [[operation(positions[i::3]) for i in range(3)] for operation in (min, max)]
            parts.append({
                "id": node["name"], "name": name,
                "conceptId": extras.get("ontologyid") or "HRA:" + node["name"],
                "system": system, "chunk": len(chunks),
                "positions": append(positions), "normals": append(normals), "indices": append(indices),
                "vertexCount": len(positions) // 3, "indexCount": len(indices), "bounds": bounds,
            })
            nodeparts[ni] = node["name"]
            triangles += len(indices) // 3
        flush()

        def descendants(index):
            """Collect named mesh identifiers below a hierarchy node."""
            result = [nodeparts[index]] if index in nodeparts else []
            for child in nodes[index].get("children", []):
                result.extend(descendants(child))
            return result

        concepts, seen = [], set()
        for i, node in enumerate(nodes):
            elements = descendants(i)
            name = node.get("extras", {}).get("label") or node["name"].replace("VH_F_", "").replace("_", " ")
            identity = (name, tuple(elements))
            if not elements or identity in seen:
                continue
            seen.add(identity)
            concepts.append({"id": "HRA:" + node["name"], "name": name, "elements": elements})
        atlas = {
            "version": "HRA united-female v1.5", "sex": "female", "source": "Human Reference Atlas",
            "scope": "Female reference assembly · partial skeleton and muscle coverage",
            "parts": parts, "concepts": concepts, "chunks": chunks, "triangles": triangles,
        }
        (stage / "atlas.json").write_text(json.dumps(atlas, separators=(",", ":")), encoding="utf-8")
        for chunk in chunks:
            filename = chunk["url"].rsplit("/", 1)[1]
            (stage / filename).replace(output / filename)
        (stage / "atlas.json").replace(output / "atlas.json")
        print(json.dumps({"parts": len(parts), "concepts": len(concepts), "triangles": triangles, "chunks": len(chunks)}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "public" / "models" / "female")
    args = parser.parse_args()
    convert(args.source, args.output)
