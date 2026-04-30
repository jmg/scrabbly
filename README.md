# Scrabbly

A Scrabble game engine written in pure Python. Supports English and Spanish
dictionaries out of the box.

## Install

```bash
pip install scrabbly
```

Or from source:

```bash
pip install -e ".[dev]"
```

## Usage

```python
from scrabbly import Board, Player, Tile, Word

alice = Player("Alice")
bob = Player("Bob")
board = Board((15, 15), [alice, bob], language="english")

board.play(Word([Tile("O", (0, 0)), Tile("F", (1, 0))]))
board.play(Word([Tile("O", (1, -1))]))

print(alice.name, alice.points)
print(bob.name, bob.points)
```

Draw random tiles for a rack:

```python
rack = board.get_random_tiles(7)
```

Query dictionaries directly:

```python
from scrabbly import Dictionary

"duck" in Dictionary()            # English (default)
"pato" in Dictionary("spanish")   # Spanish
```

## Development

```bash
pip install -e ".[dev]"
python -m pytest
# or
python -m unittest tests
```

## Building & releasing

```bash
python -m build
python -m twine upload dist/*
```

The convenience script `./upload.sh` runs the same steps.

## License

GPL-3.0-or-later.
