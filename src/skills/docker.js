import { Skill } from '../core/skillManager.js';
import { execa } from 'execa';
import chalk from 'chalk';

export default class DockerSkill extends Skill {
  constructor() {
    super('docker', 'Manage Docker containers, images, and services');
    this.commands = {
      ps: 'List containers',
      images: 'List images',
      logs: 'View container logs',
      exec: 'Execute command in container',
      stop: 'Stop container',
      start: 'Start container',
      restart: 'Restart container',
      rm: 'Remove container',
      rmi: 'Remove image',
      pull: 'Pull image',
      build: 'Build image',
      compose: 'Docker compose operations'
    };
  }

  async execute(args) {
    const [command, ...params] = args;

    if (!command) {
      return {
        success: false,
        message: 'Docker command required. Available: ' + Object.keys(this.commands).join(', ')
      };
    }

    try {
      switch (command) {
        case 'ps':
          return await this.listContainers(params);
        case 'images':
          return await this.listImages(params);
        case 'logs':
          return await this.viewLogs(params);
        case 'exec':
          return await this.execCommand(params);
        case 'stop':
          return await this.stopContainer(params);
        case 'start':
          return await this.startContainer(params);
        case 'restart':
          return await this.restartContainer(params);
        case 'rm':
          return await this.removeContainer(params);
        case 'rmi':
          return await this.removeImage(params);
        case 'pull':
          return await this.pullImage(params);
        case 'build':
          return await this.buildImage(params);
        case 'compose':
          return await this.composeCommand(params);
        default:
          const { stdout } = await execa('docker', [command, ...params]);
          return {
            success: true,
            message: `Docker ${command} executed`,
            output: stdout
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Docker error: ${error.message}`
      };
    }
  }

  async listContainers(params) {
    const all = params.includes('-a') || params.includes('--all');
    const args = ['ps', '--format', 'table {{.ID}}\\t{{.Names}}\\t{{.Status}}\\t{{.Image}}'];
    if (all) args.push('-a');
    
    const { stdout } = await execa('docker', args);
    return {
      success: true,
      message: all ? 'All containers:' : 'Running containers:',
      output: stdout
    };
  }

  async listImages(params) {
    const { stdout } = await execa('docker', ['images', '--format', 'table {{.Repository}}:{{.Tag}}\\t{{.ID}}\\t{{.Size}}\\t{{.CreatedSince}}']);
    return {
      success: true,
      message: 'Docker images:',
      output: stdout
    };
  }

  async viewLogs(params) {
    if (params.length === 0) {
      return {
        success: false,
        message: 'Container name or ID required'
      };
    }

    const [container, ...options] = params;
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
    args.push(container);

    const { stdout } = await execa('docker', args);
    return {
      success: true,
      message: `Logs for ${container}:`,
      output: stdout
    };
  }

  async execCommand(params) {
    if (params.length < 2) {
      return {
        success: false,
        message: 'Usage: docker exec <container> <command>'
      };
    }

    const [container, ...command] = params;
    const { stdout } = await execa('docker', ['exec', container, ...command]);
    return {
      success: true,
      message: `Executed in ${container}`,
      output: stdout
    };
  }

  async stopContainer(params) {
    if (params.length === 0) {
      return {
        success: false,
        message: 'Container name or ID required'
      };
    }

    await execa('docker', ['stop', ...params]);
    return {
      success: true,
      message: `Stopped container(s): ${params.join(', ')}`
    };
  }

  async startContainer(params) {
    if (params.length === 0) {
      return {
        success: false,
        message: 'Container name or ID required'
      };
    }

    await execa('docker', ['start', ...params]);
    return {
      success: true,
      message: `Started container(s): ${params.join(', ')}`
    };
  }

  async restartContainer(params) {
    if (params.length === 0) {
      return {
        success: false,
        message: 'Container name or ID required'
      };
    }

    await execa('docker', ['restart', ...params]);
    return {
      success: true,
      message: `Restarted container(s): ${params.join(', ')}`
    };
  }

  async removeContainer(params) {
    if (params.length === 0) {
      return {
        success: false,
        message: 'Container name or ID required'
      };
    }

    const force = params.includes('-f') || params.includes('--force');
    const containers = params.filter(p => !p.startsWith('-'));
    const args = ['rm'];
    if (force) args.push('-f');
    args.push(...containers);

    await execa('docker', args);
    return {
      success: true,
      message: `Removed container(s): ${containers.join(', ')}`
    };
  }

  async removeImage(params) {
    if (params.length === 0) {
      return {
        success: false,
        message: 'Image name or ID required'
      };
    }

    await execa('docker', ['rmi', ...params]);
    return {
      success: true,
      message: `Removed image(s): ${params.join(', ')}`
    };
  }

  async pullImage(params) {
    if (params.length === 0) {
      return {
        success: false,
        message: 'Image name required'
      };
    }

    const { stdout } = await execa('docker', ['pull', ...params]);
    return {
      success: true,
      message: `Pulled image: ${params[0]}`,
      output: stdout
    };
  }

  async buildImage(params) {
    const tagIndex = params.findIndex(p => p === '-t' || p === '--tag');
    const tag = tagIndex !== -1 ? params[tagIndex + 1] : 'latest';
    
    const { stdout } = await execa('docker', ['build', ...params]);
    return {
      success: true,
      message: `Built image${tag ? `: ${tag}` : ''}`,
      output: stdout
    };
  }

  async composeCommand(params) {
    if (params.length === 0) {
      return {
        success: false,
        message: 'Compose command required (up, down, ps, logs, etc.)'
      };
    }

    const { stdout } = await execa('docker', ['compose', ...params]);
    return {
      success: true,
      message: `Docker compose ${params[0]} executed`,
      output: stdout
    };
  }

  help() {
    const commands = Object.entries(this.commands)
      .map(([cmd, desc]) => `  ${chalk.green(cmd.padEnd(10))} ${chalk.gray(desc)}`)
      .join('\n');
    
    return `Docker skill commands:\n${commands}\n\nExamples:\n` +
      `  ${chalk.cyan('qalam run docker ps')} - List running containers\n` +
      `  ${chalk.cyan('qalam run docker logs app-container')} - View container logs\n` +
      `  ${chalk.cyan('qalam run docker exec db-container mysql -u root')} - Execute command in container`;
  }
}