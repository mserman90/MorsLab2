"""Render the MorsLab mark using only the Python standard library."""
import math
import struct
import zlib
from pathlib import Path


def chunk(kind, data):
    return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)


def render(size, filename):
    scale = size / 64
    background = (61, 97, 70)
    capsules = [(19.5, 19.5, 23.5), (32.5, 44.5, 23.5), (19.5, 31.5, 40.5), (45.5, 45.5, 40.5)]
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            distances = []
            for left, right, center_y in capsules:
                nearest = min(max(x + 0.5, left * scale), right * scale)
                distances.append(math.hypot(x + 0.5 - nearest, y + 0.5 - center_y * scale))
            coverage = min(1, max(0, 3.5 * scale + 0.5 - min(distances)))
            rows.extend(round(channel + (255 - channel) * coverage) for channel in background)
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('!2I5B', size, size, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(rows), 9))
    png += chunk(b'IEND', b'')
    Path('public/icons').mkdir(parents=True, exist_ok=True)
    Path('public/icons', filename).write_bytes(png)


for dimensions, name in [(192, 'icon-192.png'), (512, 'icon-512.png'), (512, 'icon-maskable-512.png')]:
    render(dimensions, name)