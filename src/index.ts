import { fixTask } from './fix';
import { pullTask } from './pull';
import { pushTask } from './push';
import { sitePullTask } from './site-pull'
import { sitePushTask } from './site-push'
import { setEnvironment } from './utils/useEnv';

// 解析命令行参数
const args = process.argv.slice(2);
const command = args[0];
const isForce = args.includes('-f') || args.includes('--force');

// 解析环境参数（dev, acc, prod）
let environment = 'dev'; // 默认环境
const envArg = args.find(arg => ['dev', 'acc', 'prod'].includes(arg.toLowerCase()));
if (envArg) {
  environment = envArg.toLowerCase();
}

// 设置环境
setEnvironment(environment);

// 获取其他参数（用于 site-pull 和 site-push）
const otherArgs = args.filter(arg => 
  arg !== command && 
  !['dev', 'acc', 'prod', '-f', '--force'].includes(arg.toLowerCase())
);

switch (command) {
  case 'fix':
    fixTask();
    break;
  case 'pull':
    pullTask(isForce);
    break;
  case 'push':
    pushTask(isForce);
    break;
  case 'site-pull':
    sitePullTask(otherArgs[0]);
    break;
  case 'site-push':
    sitePushTask(otherArgs[0]);
    break;
  default:
    console.log('无效命令');
    console.log('可用命令: fix, pull, push, site-pull, site-push');
    console.log('环境参数: dev, acc, prod (可选，默认为 dev)');
    console.log('示例: node index.js push acc -f');
    process.exit(1);
}


