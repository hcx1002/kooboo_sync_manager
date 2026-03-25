#!/usr/bin/env node
import { fixTask } from '../fix';
import { setEnvironment } from '../utils/useEnv';

const args = process.argv.slice(2);
const envArg = args.find(arg => ['dev', 'acc', 'prod'].includes(arg.toLowerCase()));

// 设置环境（默认为 dev）
setEnvironment(envArg?.toLowerCase() || 'dev');

fixTask();