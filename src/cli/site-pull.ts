#!/usr/bin/env node
import { sitePullTask } from '../site-pull';
import { setEnvironment } from '../utils/useEnv';

const args = process.argv.slice(2);
const envArg = args.find(arg => ['dev', 'acc', 'prod'].includes(arg.toLowerCase()));
const modules = args.find(arg => !['dev', 'acc', 'prod'].includes(arg.toLowerCase()));

// 设置环境（默认为 dev）
setEnvironment(envArg?.toLowerCase() || 'dev');

sitePullTask(modules);