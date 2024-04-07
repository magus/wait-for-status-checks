import {Run} from './types'
import * as core from '@actions/core'

// find latest run for each run grouped by run.name
//
// workflowDatabaseId is the same for all runs for a workflow but does not seem available
// try this out for two runs to see run.workflowDatabaseId is the same
//
//   > gh run view 8558832386 --json conclusion,createdAt,databaseId,displayTitle,event,headBranch,headSha,jobs,name,number,startedAt,status,updatedAt,url,workflowDatabaseId,workflowName | jq ".workflowDatabaseId"
//   63472138
//
//   > gh run view 8571147084 --json conclusion,createdAt,databaseId,displayTitle,event,headBranch,headSha,jobs,name,number,startedAt,status,updatedAt,url,workflowDatabaseId,workflowName | jq ".workflowDatabaseId"
//   63472138
//

export function latest_run_list(run_list: Run[]): Run[] {
  const lookup: Record<string, Run> = {}

  for (const run of run_list) {
    if (!run.started_at) {
      core.info(`> skip run "${run.name}" with missing started_at`)
      continue
    }

    const current = lookup[run.name]

    if (!current) {
      lookup[run.name] = run
      continue
    }

    if (!current.started_at) {
      throw new Error('invariant current.started_at must exist')
    }

    if (new Date(run.started_at) > new Date(current.started_at)) {
      lookup[run.name] = run
    }
  }

  return Object.values(lookup)
}
