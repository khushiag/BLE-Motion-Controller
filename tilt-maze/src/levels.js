// Maze levels. Each string is one row of the board, seen from above.
//   #  wall          .  floor
//   O  hole (fall in and you restart)
//   S  start         G  goal
// All rows in a level must be the same length.

export const LEVELS = [
  {
    name: 'Warm-up',
    rows: [
      '#########',
      '#S......#',
      '#####...#',
      '#.......#',
      '#...#####',
      '#......G#',
      '#########',
    ],
  },
  {
    name: 'Pitfalls',
    rows: [
      '#############',
      '#S....#.....#',
      '#.....#..O..#',
      '#..O..#.....#',
      '#.....#..#..#',
      '###.###..#..#',
      '#........#..#',
      '#..O.....#G.#',
      '#############',
    ],
  },
  {
    name: 'Zigzag',
    rows: [
      '#############',
      '#S..........#',
      '#.OOOO......#',
      '#...........#',
      '#..OOOOOOOOO#',
      '#...........#',
      '#.OOOOOOO...#',
      '#G..........#',
      '#############',
    ],
  },
];