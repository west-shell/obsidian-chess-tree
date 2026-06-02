import { describe, test, expect } from 'vitest'
import { PGNParser } from './parser'

describe('Chess PGN Parser', () => {
  test('parse simple move sequence', () => {
    const pgn = `
      [Event "Test Game"]
      1. e4 e5
      2. Nf3 Nc6
    `

    const parser = new PGNParser(pgn)
    const gameTree = parser.getRoot()
    expect(gameTree.id).toBe('node-root')
    expect(gameTree.children).toHaveLength(1)

    const move1 = gameTree.children[0]
    expect(move1.move?.san).toBe('e4')
    expect(move1.side).toBe('white')
    expect(move1.step).toBe(1)
    expect(move1.children).toHaveLength(1)
    expect(move1.fen).toBeTruthy()

    const move2 = move1.children[0]
    expect(move2.move?.san).toBe('e5')
    expect(move2.side).toBe('black')
    expect(move2.step).toBe(2)
    expect(move2.fen).toBeTruthy()
  })

  test('parse moves with comments', () => {
    const pgn = `
      1. e4 {A key move} e5
      2. Nf3 Nc6
    `
    const parser = new PGNParser(pgn)
    const gameTree = parser.getRoot()

    const whiteMove = gameTree.children[0]
    expect(whiteMove.comments).toEqual(['A key move'])

    const blackMove = whiteMove.children[0]
    expect(blackMove.comments).toEqual([])
  })

  test('parse variations', () => {
    const pgn = `
      1. e4 (1. d4 {Alternative} d5) e5
    `
    const parser = new PGNParser(pgn)
    const gameTree = parser.getRoot()
    const mainLine = gameTree.children[0]

    expect(mainLine.move?.san).toBe('e4')
    expect(mainLine.children).toHaveLength(1)

    const variation = gameTree.children[1]
    expect(variation.children).toHaveLength(1)
    expect(variation.move?.san).toBe('d4')
    expect(variation.comments).toEqual(['Alternative'])
  })
})
