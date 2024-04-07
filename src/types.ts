import {GitHub} from '@actions/github/lib/utils'

type Client = InstanceType<typeof GitHub>
type ListForRefFn = Client['rest']['checks']['listForRef']
type ListForRefReturn = Awaited<ReturnType<ListForRefFn>>

export type Run = ListForRefReturn['data']['check_runs'][number]
