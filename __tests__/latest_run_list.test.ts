import {expect, test} from '@jest/globals'
import {Run} from '../src/types'
import {latest_run_list} from '../src/latest_run_list'

test('latest run for each run grouped by run.name', async () => {
  const run_list = [
    mock_run({name: 'A', started_at: '2024-04-01T00:00:00Z'}),
    mock_run({name: 'A', started_at: '2024-04-02T00:00:00Z'}),

    mock_run({name: 'B', started_at: '2024-03-31T00:00:00Z'}),
    mock_run({name: 'B', started_at: '2024-04-01T01:00:00Z'}),

    // C missing started_at should be skipped
    mock_run({name: 'C', started_at: undefined})
  ]

  expect(latest_run_list(run_list)).toEqual([
    {
      name: 'A',
      started_at: '2024-04-02T00:00:00Z'
    },
    {
      name: 'B',
      started_at: '2024-04-01T01:00:00Z'
    }
  ])
})

function mock_run(override?: Partial<Run>): Run {
  const base_run = {
    name: 'github-action',
    started_at: '2024-04-05T14:12:00Z'
  }

  return Object.assign(base_run, override) as Run
}
