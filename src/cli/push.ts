#!/usr/bin/env node
import { pushTask } from '../push';
import { setEnvironment } from '../utils/useEnv';

const args = process.argv.slice(2);
const force = args.includes('-f') || args.includes('--force');
const envArg = args.find(arg => ['dev', 'acc', 'prod'].includes(arg.toLowerCase()));

// 设置环境（默认为 dev）
setEnvironment(envArg?.toLowerCase() || 'dev');

pushTask(force);