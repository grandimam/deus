import { Skill } from '../core/skillManager.js';
import { execa } from 'execa';
import chalk from 'chalk';

export default class KubectlSkill extends Skill {
  constructor() {
    super('kubectl', 'Manage Kubernetes clusters and resources');
    this.commands = {
      get: 'List resources',
      describe: 'Show details of a resource',
      logs: 'Print logs from a container',
      exec: 'Execute command in container',
      apply: 'Apply a configuration',
      delete: 'Delete resources',
      scale: 'Scale a deployment',
      rollout: 'Manage rollouts',
      port: 'Port forwarding',
      context: 'Manage contexts'
    };
  }

  async execute(args) {
    const [command, ...params] = args;

    if (!command) {
      return {
        success: false,
        message: 'Kubectl command required. Available: ' + Object.keys(this.commands).join(', ')
      };
    }

    try {
      switch (command) {
        case 'get':
          return await this.getResources(params);
        case 'describe':
          return await this.describeResource(params);
        case 'logs':
          return await this.getLogs(params);
        case 'exec':
          return await this.execCommand(params);
        case 'apply':
          return await this.applyConfig(params);
        case 'delete':
          return await this.deleteResource(params);
        case 'scale':
          return await this.scaleDeployment(params);
        case 'rollout':
          return await this.manageRollout(params);
        case 'port':
          return await this.portForward(params);
        case 'context':
          return await this.manageContext(params);
        default:
          const { stdout } = await execa('kubectl', [command, ...params]);
          return {
            success: true,
            message: `kubectl ${command} executed`,
            output: stdout
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Kubectl error: ${error.message}`
      };
    }
  }

  async getResources(params) {
    if (params.length === 0) {
      params = ['pods'];
    }

    const [resource, ...options] = params;
    const args = ['get', resource];
    
    if (!options.includes('-o') && !options.includes('--output')) {
      args.push('-o', 'wide');
    }
    
    const namespace = this.extractNamespace(options);
    if (namespace) {
      args.push('-n', namespace);
    } else if (options.includes('-A') || options.includes('--all-namespaces')) {
      args.push('-A');
    }
    
    args.push(...options.filter(o => !o.startsWith('-n') && o !== '-A' && o !== '--all-namespaces'));

    const { stdout } = await execa('kubectl', args);
    return {
      success: true,
      message: `Kubernetes ${resource}:`,
      output: stdout
    };
  }

  async describeResource(params) {
    if (params.length < 1) {
      return {
        success: false,
        message: 'Resource type and name required'
      };
    }

    const { stdout } = await execa('kubectl', ['describe', ...params]);
    return {
      success: true,
      message: `Resource details:`,
      output: stdout
    };
  }

  async getLogs(params) {
    if (params.length === 0) {
      return {
        success: false,
        message: 'Pod name required'
      };
    }

    const [pod, ...options] = params;
    const args = ['logs'];
    
    if (options.includes('-f') || options.includes('--follow')) {
      args.push('-f');
    }
    
    if (options.includes('--tail')) {
      const tailIndex = options.indexOf('--tail');
      if (tailIndex !== -1 && options[tailIndex + 1]) {
        args.push('--tail', options[tailIndex + 1]);
      }
    } else {
      args.push('--tail', '50');
    }
    
    const namespace = this.extractNamespace(options);
    if (namespace) {
      args.push('-n', namespace);
    }
    
    args.push(pod);
    
    const container = options.find(o => o.startsWith('-c=')) || options[options.indexOf('-c') + 1];
    if (container) {
      args.push('-c', container.replace('-c=', ''));
    }

    const { stdout } = await execa('kubectl', args);
    return {
      success: true,
      message: `Logs for ${pod}:`,
      output: stdout
    };
  }

  async execCommand(params) {
    if (params.length < 3) {
      return {
        success: false,
        message: 'Usage: kubectl exec <pod> -- <command>'
      };
    }

    const dashIndex = params.indexOf('--');
    if (dashIndex === -1) {
      return {
        success: false,
        message: 'Use -- to separate pod name from command'
      };
    }

    const podParams = params.slice(0, dashIndex);
    const command = params.slice(dashIndex + 1);
    
    const args = ['exec'];
    
    if (podParams.includes('-it')) {
      args.push('-it');
      podParams.splice(podParams.indexOf('-it'), 1);
    }
    
    const namespace = this.extractNamespace(podParams);
    if (namespace) {
      args.push('-n', namespace);
    }
    
    const pod = podParams.find(p => !p.startsWith('-'));
    args.push(pod, '--', ...command);

    const { stdout } = await execa('kubectl', args);
    return {
      success: true,
      message: `Executed in ${pod}`,
      output: stdout
    };
  }

  async applyConfig(params) {
    if (params.length === 0) {
      return {
        success: false,
        message: 'Configuration file or resource required'
      };
    }

    const { stdout } = await execa('kubectl', ['apply', ...params]);
    return {
      success: true,
      message: 'Configuration applied',
      output: stdout
    };
  }

  async deleteResource(params) {
    if (params.length < 2) {
      return {
        success: false,
        message: 'Resource type and name required'
      };
    }

    const { stdout } = await execa('kubectl', ['delete', ...params]);
    return {
      success: true,
      message: 'Resource deleted',
      output: stdout
    };
  }

  async scaleDeployment(params) {
    if (params.length < 2) {
      return {
        success: false,
        message: 'Usage: kubectl scale deployment/<name> --replicas=<number>'
      };
    }

    const { stdout } = await execa('kubectl', ['scale', ...params]);
    return {
      success: true,
      message: 'Deployment scaled',
      output: stdout
    };
  }

  async manageRollout(params) {
    if (params.length === 0) {
      return {
        success: false,
        message: 'Rollout command required (status, history, undo, restart)'
      };
    }

    const { stdout } = await execa('kubectl', ['rollout', ...params]);
    return {
      success: true,
      message: `Rollout ${params[0]} executed`,
      output: stdout
    };
  }

  async portForward(params) {
    if (params.length < 2) {
      return {
        success: false,
        message: 'Usage: kubectl port <pod> <local-port>:<remote-port>'
      };
    }

    console.log(chalk.yellow('Starting port forwarding... Press Ctrl+C to stop'));
    const { stdout } = await execa('kubectl', ['port-forward', ...params]);
    return {
      success: true,
      message: 'Port forwarding established',
      output: stdout
    };
  }

  async manageContext(params) {
    const [subcommand, ...options] = params;
    
    // Context aliases for quick switching
    const contextAliases = {
      'beta': { context: 'beta-eks-cluster', namespace: 'beta-pro' },
      'prod': { context: 'prod-eks-cluster', namespace: 'prod' },
      'prd': { context: 'prod-eks-cluster', namespace: 'prod' },
      'space': { context: 'space-eks-cluster', namespace: 'dev-space' },
      'spaceme': { context: 'space-eks-cluster', namespace: 'dev-space', region: 'me-central-1' },
      'space-gold': { context: 'space-gold-eks-cluster', namespace: 'dev-space' }
    };
    
    if (!subcommand) {
      return await this.showContextInfo();
    }

    // Check if subcommand is an alias
    if (contextAliases[subcommand]) {
      return await this.switchToEnvironment(subcommand, contextAliases[subcommand]);
    }

    switch (subcommand) {
      case 'list':
        const { stdout: listOut } = await execa('kubectl', ['config', 'get-contexts']);
        return {
          success: true,
          message: 'Available contexts:',
          output: listOut + '\n\n' + chalk.yellow('Quick aliases: beta, prod, space, spaceme, space-gold')
        };
      
      case 'use':
        if (options.length === 0) {
          return {
            success: false,
            message: 'Context name required'
          };
        }
        
        // Check if it's an alias
        if (contextAliases[options[0]]) {
          return await this.switchToEnvironment(options[0], contextAliases[options[0]]);
        }
        
        const { stdout: useOut } = await execa('kubectl', ['config', 'use-context', options[0]]);
        return {
          success: true,
          message: `Switched to context: ${options[0]}`,
          output: useOut
        };
      
      case 'current':
        return await this.showContextInfo();
      
      case 'namespace':
      case 'ns':
        if (options.length === 0) {
          const { stdout: ns } = await execa('kubectl', ['config', 'view', '--minify', '-o', 'jsonpath={..namespace}']);
          return {
            success: true,
            message: 'Current namespace:',
            output: ns || 'default'
          };
        }
        // Use kubens if available, otherwise kubectl
        try {
          await execa('which', ['kubens']);
          const { stdout } = await execa('kubens', [options[0]]);
          return {
            success: true,
            message: `Switched namespace to: ${options[0]}`,
            output: stdout
          };
        } catch (error) {
          await execa('kubectl', ['config', 'set-context', '--current', '--namespace=' + options[0]]);
          return {
            success: true,
            message: `Switched namespace to: ${options[0]}`
          };
        }
      
      default:
        // Try as a direct context switch
        try {
          await execa('kubectl', ['config', 'use-context', subcommand]);
          return {
            success: true,
            message: `Switched to context: ${subcommand}`
          };
        } catch (error) {
          return {
            success: false,
            message: 'Unknown context command. Use: list, use, current, namespace (ns), or aliases: beta, prod, space'
          };
        }
    }
  }

  async switchToEnvironment(name, config) {
    console.log(chalk.yellow(`Switching to ${name} environment...`));
    
    try {
      // Build full context name if needed
      let fullContext = config.context;
      if (!config.context.includes('arn:aws:eks')) {
        // Get account ID from existing contexts
        const { stdout } = await execa('kubectl', ['config', 'get-contexts', '-o', 'name']);
        const contexts = stdout.split('\n');
        const matchingContext = contexts.find(ctx => ctx.includes(config.context));
        
        if (matchingContext) {
          fullContext = matchingContext;
        }
      }
      
      // Switch context
      try {
        await execa('kubectl', ['config', 'use-context', fullContext]);
      } catch (error) {
        // Context might not exist, try updating kubeconfig
        console.log(chalk.gray('Context not found, updating kubeconfig...'));
        const region = config.region || 'eu-west-1';
        await execa('aws', ['eks', 'update-kubeconfig', '--name', config.context, '--region', region]);
      }
      
      // Switch namespace if specified
      if (config.namespace) {
        try {
          await execa('which', ['kubens']);
          await execa('kubens', [config.namespace]);
        } catch (error) {
          await execa('kubectl', ['config', 'set-context', '--current', '--namespace=' + config.namespace]);
        }
      }
      
      // Show current status
      const { stdout: context } = await execa('kubectl', ['config', 'current-context']);
      const { stdout: namespace } = await execa('kubectl', ['config', 'view', '--minify', '-o', 'jsonpath={..namespace}']);
      
      return {
        success: true,
        message: `Switched to ${name} environment`,
        output: `Context: ${context.trim()}\nNamespace: ${namespace || 'default'}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to switch to ${name}: ${error.message}`
      };
    }
  }

  async showContextInfo() {
    try {
      const { stdout: context } = await execa('kubectl', ['config', 'current-context']);
      const { stdout: namespace } = await execa('kubectl', ['config', 'view', '--minify', '-o', 'jsonpath={..namespace}']);
      const { stdout: cluster } = await execa('kubectl', ['config', 'view', '--minify', '-o', 'jsonpath={.clusters[0].name}']);
      
      // Try to get cluster info
      let clusterInfo = '';
      try {
        const { stdout: nodes } = await execa('kubectl', ['get', 'nodes', '--no-headers']);
        const nodeCount = nodes.split('\n').filter(n => n).length;
        clusterInfo = `Nodes: ${nodeCount}`;
      } catch (error) {
        clusterInfo = 'Cluster access: checking...';
      }
      
      return {
        success: true,
        message: 'Current context info:',
        output: `Context: ${context.trim()}\nCluster: ${cluster.trim()}\nNamespace: ${namespace || 'default'}\n${clusterInfo}`
      };
    } catch (error) {
      return {
        success: false,
        message: 'No active context. Run: qalam kubectl context use <context>'
      };
    }
  }

  extractNamespace(params) {
    const nsIndex = params.findIndex(p => p === '-n' || p === '--namespace');
    if (nsIndex !== -1 && params[nsIndex + 1]) {
      return params[nsIndex + 1];
    }
    const nsParam = params.find(p => p.startsWith('-n=') || p.startsWith('--namespace='));
    if (nsParam) {
      return nsParam.split('=')[1];
    }
    return null;
  }

  help() {
    const commands = Object.entries(this.commands)
      .map(([cmd, desc]) => `  ${chalk.green(cmd.padEnd(10))} ${chalk.gray(desc)}`)
      .join('\n');
    
    return `Kubectl skill commands:\n${commands}\n\n` +
      `${chalk.blue('Context Management:')}\n` +
      `  ${chalk.cyan('qalam kubectl context beta')} - Switch to beta environment\n` +
      `  ${chalk.cyan('qalam kubectl context prod')} - Switch to production\n` +
      `  ${chalk.cyan('qalam kubectl context space')} - Switch to dev space\n` +
      `  ${chalk.cyan('qalam kubectl context ns <name>')} - Change namespace\n\n` +
      `${chalk.blue('Examples:')}\n` +
      `  ${chalk.cyan('qalam kubectl get pods')} - List all pods\n` +
      `  ${chalk.cyan('qalam kubectl logs my-pod')} - View pod logs\n` +
      `  ${chalk.cyan('qalam kubectl exec my-pod -- bash')} - Execute bash in pod\n\n` +
      `${chalk.yellow('Quick Aliases:')} beta, prod, space, spaceme, space-gold`;
  }
}