import {GitHub} from '@actions/github/lib/utils'
import {Run} from './types'
import * as core from '@actions/core'
import {wait} from './wait'
import {latest_run_list} from './latest_run_list'
export interface Config {
  client: InstanceType<typeof GitHub>
  owner: string
  repo: string
  ref: string

  // frequency and timeout
  intervalSeconds: number
  timeoutSeconds: number

  // ignore
  ignoreChecks: string[]
}

export async function poll(config: Config): Promise<void> {
  const {
    client,
    owner,
    repo,
    ref,
    intervalSeconds,
    timeoutSeconds,
    ignoreChecks
  } = config
  let elapsedSeconds = 0

  core.info('Starting polling GitHub Check runs...')
  core.info(`timeout: ${timeoutSeconds} seconds`)
  core.info(`interval: ${intervalSeconds} seconds`)
  core.info(`ignore: ${JSON.stringify(ignoreChecks)}`)

  while (elapsedSeconds < timeoutSeconds) {
    try {
      // List GitHub Check Runs
      // https://docs.github.com/en/rest/checks/runs?apiVersion=2022-11-28#list-check-runs-for-a-git-reference
      core.info(`Fetching check runs for ${owner}/${repo}@${ref}`)
      let pageNumber = 0
      let totalChecks = 0
      let all_check_runs: Run[] = []
      do {
        pageNumber++
        const response = await client.rest.checks.listForRef({
          owner,
          repo,
          ref,
          per_page: 100,
          page: pageNumber
        })

        totalChecks = response.data.total_count

        core.debug(
          `Received ${response.data.check_runs.length} check runs on page ${pageNumber}`
        )
        all_check_runs = all_check_runs.concat(response.data.check_runs)
        core.debug(
          `Received a total of ${all_check_runs.length} check runs and expected ${response.data.total_count}`
        )
        await wait(intervalSeconds * 100)
      } while (totalChecks > all_check_runs.length)

      core.debug(`Received ${totalChecks} total check runs`)

      // ignore the current job's check run
      const filteredRuns = all_check_runs.filter(
        run => !ignoreChecks.includes(run.name)
      )
      core.info(`Parse ${filteredRuns.length} filtered runs`)
      for (const run of filteredRuns) {
        core.debug(
          `> filtered run "${run.name}" is "${run.status}" with conclusion "${run.conclusion}"`
        )
      }

      core.info('DEBUG RUN LIST')
      core.info('------------------------START------------------------')
      core.info(JSON.stringify(filteredRuns))
      core.info('-------------------------END-------------------------')

      // latestRunByName now contains the latest run grouped by run.name
      // we convert them back into a list for subsequent checks
      const check_runs = Object.values(latest_run_list(filteredRuns))

      // exit immediately if any runs completed without success (skipped counts as success)
      const failed = check_runs.filter(isFailure)

      if (failed.length > 0) {
        core.info('One or more watched check runs were not successful')
        for (const run of failed) {
          core.info(
            `> check run "${run.name}" is completed with conclusion "${run.conclusion}" (unsuccessful)`
          )
          core.info(`    ${run.url}`)
        }
        core.setFailed('One or more check runs were not successful')
        return
      }

      // exit when all check runs completed without failure
      if (check_runs.every(run => run.status === 'completed')) {
        core.info('All runs completed without failure')
        return
      }

      // show pending (or queued) check runs
      const pending = check_runs.filter(run => run.status !== 'completed')
      if (pending.length > 0) {
        core.info(`${pending.length} check runs have not yet completed`)
      }
      for (const run of pending) {
        core.info(`> check run ${run.name} is still ${run.status}`)
      }
    } catch (error) {
      core.error(`error ${error}`)
    }

    core.info(`Retry in ${intervalSeconds}`)
    core.info('')
    elapsedSeconds += intervalSeconds
    await wait(intervalSeconds * 1000)
  }

  core.info(`elapsed time ${elapsedSeconds} exceeds timeout ${timeoutSeconds}`)
}

function isFailure(run: CheckRun): boolean {
  if (run.status === 'completed') {
    // all conclusions besides success or skipped are considered failures
    return run.conclusion !== 'success' && run.conclusion !== 'skipped'
  }
  // run is still queued or pending
  return false
}

interface CheckRun {
  name: string
  status: string
  conclusion:
    | (
        | 'success'
        | 'failure'
        | 'neutral'
        | 'cancelled'
        | 'skipped'
        | 'timed_out'
        | 'action_required'
      )
    | null
}
