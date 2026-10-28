#!/usr/bin/env python3
"""Regenerates layouts/default.json. Edit the constants below, or edit the JSON by hand.
Grid: x grows to the lower-right on screen, y grows to the lower-left. Tile (0,0) is the back corner.
Floor codes: '.' void, 'w' wood, 's' stone path, 'm' meeting-room stone, 'r' lounge rug, 'b' boss platform."""
import json, os
W, H = 22, 18
g = [['w'] * W for _ in range(H)]
def put(x, y, c):
    if 0 <= x < W and 0 <= y < H: g[y][x] = c
# chamfered corners of the floating platform
for (x, y) in [(21, 0), (21, 1), (20, 0), (0, 17), (0, 16), (1, 17), (21, 17), (20, 17), (21, 16)]:
    put(x, y, '.')
for x in range(1, 21): put(x, 12, 's')
for y in range(7, 17): put(11, y, 's')
for x in range(14, 21):
    for y in range(0, 7): put(x, y, 'm')
for x in range(13, 21): put(x, 7, 'm')
for y in range(0, 7): put(13, y, 'm')
for x in range(15, 20):
    for y in range(13, 17): put(x, y, 'r')
for x in range(9, 14):
    for y in range(7, 12):
        if (x - 11) ** 2 + (y - 9) ** 2 <= 4.5: put(x, y, 'b')

objects, desks = [], []
n = 0
for col in (2, 6):
    for k in range(5):
        y = 2 + 2 * k; n += 1
        objects.append({"type": "desk", "x": col, "y": y})
        objects.append({"type": "chair", "x": col + 1, "y": y, "seat": True, "face": [-1, 0]})
        desks.append({"id": n, "desk": [col, y], "seat": [col + 1, y], "face": [-1, 0]})
objects += [
    {"type": "boss_desk", "x": 12, "y": 8, "w": 1, "h": 3},
    {"type": "chair", "x": 11, "y": 9, "seat": True, "face": [1, 0]},
    {"type": "meeting_table", "x": 16, "y": 3, "w": 3, "h": 2},
    {"type": "bookshelf", "x": 9, "y": 0, "w": 2, "h": 1},
    {"type": "coffee_bar", "x": 20, "y": 9, "w": 1, "h": 3},
    {"type": "stool", "x": 19, "y": 9, "seat": True},
    {"type": "stool", "x": 19, "y": 11, "seat": True},
    {"type": "arcade", "x": 20, "y": 14},
    {"type": "armchair", "x": 16, "y": 15, "seat": True},
    {"type": "armchair", "x": 18, "y": 15, "seat": True},
    {"type": "side_table", "x": 17, "y": 15},
    {"type": "pod", "x": 2, "y": 15, "seat": True},
    {"type": "pod", "x": 4, "y": 15, "seat": True},
    {"type": "pod", "x": 6, "y": 15, "seat": True},
    {"type": "pod", "x": 8, "y": 15, "seat": True},
    {"type": "plant", "x": 0, "y": 0, "v": 0}, {"type": "plant", "x": 12, "y": 0, "v": 1},
    {"type": "plant", "x": 0, "y": 11, "v": 2}, {"type": "plant", "x": 21, "y": 7, "v": 0},
    {"type": "plant", "x": 14, "y": 13, "v": 1}, {"type": "plant", "x": 20, "y": 1, "v": 2},
    {"type": "plant", "x": 9, "y": 16, "v": 0}, {"type": "plant", "x": 14, "y": 16, "v": 2},
]
meet_seats = [[15, 3, 1, 0], [15, 4, 1, 0], [19, 3, -1, 0], [19, 4, -1, 0],
              [16, 2, 0, 1], [17, 2, 0, 1], [18, 2, 0, 1], [16, 5, 0, -1], [17, 5, 0, -1], [18, 5, 0, -1]]
for s in meet_seats:
    objects.append({"type": "chair", "x": s[0], "y": s[1], "seat": True, "face": [s[2], s[3]]})
# glass walls of the meeting room (door gaps at (13,4) and (17,7))
for y in range(0, 7):
    if y != 4: objects.append({"type": "glass", "x": 13, "y": y, "axis": "y"})
for x in range(14, 21):
    if x != 17: objects.append({"type": "glass", "x": x, "y": 7, "axis": "x"})
layout = {
    "name": "cloud-top-office", "cols": W, "rows": H,
    "floor": [''.join(r) for r in g],
    "walls": {"back_x": True, "back_y": True,
              "windows_y0": [[2, 8], [13, 20]], "windows_x0": [[8, 14]], "painting_x0": [3, 5]},
    "objects": objects,
    "zones": {
        "desks": desks,
        "boss": {"seat": [11, 9], "face": [1, 0], "tiles": [[x, y] for y in range(H) for x in range(W) if g[y][x] == 'b']},
        "meeting": {"seats": [[s[0], s[1], s[2], s[3]] for s in meet_seats], "table": [17, 3.5]},
        "pods": [[2, 15], [4, 15], [6, 15], [8, 15]],
        "approval_queue": [[13, 8], [13, 9], [14, 8], [14, 9], [13, 11], [14, 11]],
        "idle_spots": [
            {"at": [20, 12], "kind": "coffee", "face": [0, -1]},
            {"at": [19, 9], "kind": "stool", "face": [1, 0]},
            {"at": [19, 11], "kind": "stool", "face": [1, 0]},
            {"at": [20, 15], "kind": "arcade", "face": [0, -1]},
            {"at": [16, 15], "kind": "sofa", "face": [1, 0]},
            {"at": [18, 15], "kind": "sofa", "face": [-1, 0]},
            {"at": [9, 1], "kind": "books", "face": [0, -1]},
            {"at": [10, 1], "kind": "books", "face": [0, -1]},
            {"at": [4, 13], "kind": "window", "face": [0, 1]},
            {"at": [16, 10], "kind": "window", "face": [1, 0]}
        ]
    }
}
out = os.path.join(os.path.dirname(__file__), '..', 'layouts', 'default.json')
json.dump(layout, open(out, 'w'), ensure_ascii=False, indent=1)
print('wrote', out)
