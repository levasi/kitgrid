import type { PathPoint } from './types'

export function pathData(points: PathPoint[], closed: boolean): string {
  const first = points[0]
  if (!first) return ''
  const commands = [`M ${round(first.x)} ${round(first.y)}`]
  for (const point of points.slice(1)) commands.push(`L ${round(point.x)} ${round(point.y)}`)
  if (closed && points.length > 2) commands.push('Z')
  return commands.join(' ')
}

function round(value: number) {
  return Math.round(value * 100) / 100
}
