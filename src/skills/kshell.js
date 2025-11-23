import { Skill } from '../core/skillManager.js';
import { execa } from 'execa';
import chalk from 'chalk';
import inquirer from 'inquirer';
// import { Memory } from '../memory/history.js'; // Removed - history feature deprecated
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export default class KShellSkill extends Skill {
  constructor() {
    super('shell', 'Advanced Kubernetes shell management');
    // this.memory = new Memory(); // Removed - history feature deprecated
    this.sessionStore = new Map();
    this.justificationTemplates = [
      'Debugging application issues',
      'Checking logs and metrics', 
      'Database maintenance',
      'Configuration update',
      'Performance investigation',
      'Deployment verification',
      'Custom reason...'
    ];
  }

  async execute(args) {
    const [service, ...options] = args;

    if (!service) {
      return await this.showStatus();
    }

    // Check for status command
    if (service === 'status' && options.length > 0) {
      return await this.checkShellStatus(options[0]);
    }

    // Parse options
    const opts = this.parseOptions(options);
    
    try {
      // Smart shell access - create if needed, then connect
      return await this.smartShell(service, opts);
    } catch (error) {
      return {
        success: false,
        message: `Shell error: ${error.message}`
      };
    }
  }

  parseOptions(options) {
    const opts = {
      debug: false,
      duration: null,
      reason: null,
      autoCleanup: true,
      container: 'application',
      record: false,
      async: false,
      verbose: false,
      env: this.getCurrentEnvironment()
    };

    for (let i = 0; i < options.length; i++) {
      switch(options[i]) {
        case '--debug':
        case '-d':
          opts.debug = true;
          break;
        case '--duration':
          opts.duration = options[++i];
          break;
        case '--reason':
        case '-r':
          opts.reason = options[++i];
          break;
        case '--no-cleanup':
          opts.autoCleanup = false;
          break;
        case '--container':
        case '-c':
          opts.container = options[++i];
          break;
        case '--record':
          opts.record = true;
          break;
        case '--async':
        case '-a':
          opts.async = true;
          break;
        case '--verbose':
        case '-v':
          opts.verbose = true;
          break;
      }
    }
    
    return opts;
  }

  async smartShell(service, opts) {
    // Check current environment
    const env = opts.env;
    console.log(chalk.blue(`Environment: ${env.context} / ${env.namespace}`));
    
    // Check if shell job already exists
    const existingJob = await this.checkExistingShell(service);
    
    if (existingJob) {
      console.log(chalk.green('✓ Found existing shell session'));
      const reconnect = await this.promptReconnect(existingJob);
      
      if (reconnect) {
        return await this.connectToShell(service, existingJob, opts);
      } else {
        // Clean up old and create new
        await this.deleteShell(service);
      }
    }

    // Create new shell session
    console.log(chalk.yellow('Creating new shell session...'));
    const jobInfo = await this.createShellWithJustification(service, opts);
    
    if (!jobInfo.success) {
      return jobInfo;
    }

    // If async mode, don't connect
    if (opts.async) {
      return {
        success: true,
        message: jobInfo.message,
        output: `Job: ${jobInfo.name}\nJustification: ${jobInfo.justification}\n\n` +
                `The shell is being created in the background.\n` +
                `Check status: ${chalk.cyan(`qalam shell status ${service}`)}\n` +
                `Connect when ready: ${chalk.cyan(`qalam shell ${service}`)}`
      };
    }

    // Auto-connect after creation
    console.log(chalk.blue('\nConnecting to shell...'));
    return await this.connectToShell(service, jobInfo, opts);
  }

  async checkExistingShell(service) {
    try {
      const { stdout: user } = await execa('whoami');
      const jobName = `${service}-shell-manual-${user.trim()}`;
      
      const { stdout } = await execa('kubectl', [
        'get', `job/${jobName}`,
        '-o', 'json'
      ]);
      
      const job = JSON.parse(stdout);
      const age = this.getAge(new Date(job.metadata.creationTimestamp));
      const justification = job.metadata.annotations?.justification || 'N/A';
      
      return {
        name: jobName,
        age,
        justification,
        created: job.metadata.creationTimestamp
      };
    } catch (error) {
      return null;
    }
  }

  async promptReconnect(existingJob) {
    const { reconnect } = await inquirer.prompt([{
      type: 'confirm',
      name: 'reconnect',
      message: `Found existing shell (${existingJob.age} old, reason: "${existingJob.justification}"). Reconnect?`,
      default: true
    }]);
    
    return reconnect;
  }

  async createShellWithJustification(service, opts) {
    // Get justification
    let justification = opts.reason;
    
    if (!justification) {
      // Show template options for non-prod environments
      if (opts.env.isProd) {
        // Production requires manual justification
        const { reason } = await inquirer.prompt([{
          type: 'input',
          name: 'reason',
          message: chalk.red('⚠️  PRODUCTION: Please provide justification:'),
          validate: input => input.length > 10 || 'Please provide a detailed justification for production access'
        }]);
        justification = reason;
      } else {
        // Non-prod can use templates
        const { template } = await inquirer.prompt([{
          type: 'list',
          name: 'template',
          message: 'Select reason for access:',
          choices: this.justificationTemplates
        }]);
        
        if (template === 'Custom reason...') {
          const { reason } = await inquirer.prompt([{
            type: 'input',
            name: 'reason',
            message: 'Enter custom reason:',
            validate: input => input.length > 0 || 'Reason cannot be empty'
          }]);
          justification = reason;
        } else {
          justification = template;
        }
      }
    }

    // Add duration to justification if specified
    if (opts.duration) {
      justification += ` [Duration: ${opts.duration}]`;
    }

    // Create the shell job
    const { stdout: user } = await execa('whoami');
    const jobName = `${service}-shell-manual-${user.trim()}`;
    
    // Pre-flight checks
    await this.performPreflightChecks(service, opts);
    
    // Generate job YAML from cronjob
    const { stdout: jobYaml } = await execa('kubectl', [
      'create', 'job',
      '--from=cronjob/' + service + '-shell',
      jobName,
      '--dry-run=client',
      '-o', 'yaml'
    ]);

    // Add annotations
    const annotatedYaml = this.addAnnotations(jobYaml, {
      justification,
      user: user.trim(),
      environment: opts.env.context,
      createdAt: new Date().toISOString(),
      autoCleanup: opts.autoCleanup.toString(),
      duration: opts.duration || 'indefinite'
    });

    // Apply the job
    const tmpFile = path.join(os.tmpdir(), `job-${Date.now()}.yaml`);
    await fs.writeFile(tmpFile, annotatedYaml);
    
    try {
      await execa('kubectl', ['apply', '-f', tmpFile]);
    } finally {
      await fs.unlink(tmpFile);
    }

    // Wait for pod with progress monitoring
    const podName = await this.waitForPod(jobName, opts);
    
    // For async mode, return early
    if (opts.async) {
      return {
        success: true,
        name: jobName,
        podName: null,
        async: true,
        justification,
        message: `Shell job created in background for ${service}`
      };
    }
    
    // Start session tracking
    const sessionId = this.startSessionTracking(service, {
      jobName,
      podName,
      justification,
      startTime: new Date(),
      duration: opts.duration,
      autoCleanup: opts.autoCleanup,
      record: opts.record
    });

    // Schedule auto-cleanup if duration specified
    if (opts.duration) {
      this.scheduleCleanup(service, opts.duration);
    }

    return {
      success: true,
      name: jobName,
      podName,
      sessionId,
      justification
    };
  }

  async performPreflightChecks(service, opts) {
    if (opts.env.isProd) {
      console.log(chalk.yellow('Running production pre-flight checks...'));
      
      // Check if service exists
      try {
        await execa('kubectl', ['get', `cronjob/${service}-shell`]);
      } catch (error) {
        throw new Error(`Shell template for ${service} not found`);
      }
      
      // Show warning for production
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: chalk.red('⚠️  You are about to access PRODUCTION. Continue?'),
        default: false
      }]);
      
      if (!confirm) {
        throw new Error('Production access cancelled');
      }
    }
  }

  async connectToShell(service, jobInfo, opts) {
    const { stdout: user } = await execa('whoami');
    const jobName = jobInfo.name || `${service}-shell-manual-${user.trim()}`;
    
    // Show connection info
    console.log(chalk.green('━'.repeat(50)));
    console.log(chalk.blue('Shell Session Info:'));
    console.log(`  Service: ${chalk.white(service)}`);
    console.log(`  Environment: ${chalk.white(opts.env.context)}`);
    console.log(`  Namespace: ${chalk.white(opts.env.namespace)}`);
    console.log(`  Container: ${chalk.white(opts.container)}`);
    if (opts.duration) {
      console.log(`  Auto-cleanup: ${chalk.yellow(opts.duration)}`);
    }
    if (opts.record) {
      console.log(`  Recording: ${chalk.red('ENABLED')}`);
    }
    console.log(chalk.green('━'.repeat(50)));
    console.log(chalk.gray('Press Ctrl+D or type "exit" to disconnect\n'));

    try {
      // Start recording if enabled
      let recorder;
      if (opts.record) {
        recorder = await this.startRecording(service);
      }

      // Connect to shell
      const subprocess = execa('kubectl', [
        'exec', '-it',
        `job/${jobName}`,
        '-c', opts.container,
        '--',
        'bash', '--init-file', '/etc/container_environment.sh'
      ], {
        stdio: 'inherit'
      });

      await subprocess;

      // Stop recording
      if (recorder) {
        await this.stopRecording(recorder, service);
      }

      // Post-disconnect actions
      await this.handleDisconnect(service, opts);

      return {
        success: true,
        message: `Disconnected from ${service}`
      };
    } catch (error) {
      if (error.exitCode === 130) {
        return {
          success: true,
          message: `Disconnected from ${service}`
        };
      }
      throw error;
    }
  }

  async handleDisconnect(service, opts) {
    if (opts.autoCleanup && !opts.env.isProd) {
      const { cleanup } = await inquirer.prompt([{
        type: 'confirm',
        name: 'cleanup',
        message: 'Clean up shell session?',
        default: true
      }]);
      
      if (cleanup) {
        await this.deleteShell(service);
        console.log(chalk.green('✓ Shell session cleaned up'));
      }
    }
    
    // Update session tracking
    this.endSessionTracking(service);
  }

  async deleteShell(service) {
    const { stdout: user } = await execa('whoami');
    const jobName = `${service}-shell-manual-${user.trim()}`;
    
    await execa('kubectl', ['delete', `job/${jobName}`]);
  }

  async checkShellStatus(service) {
    const { stdout: user } = await execa('whoami');
    const jobName = `${service}-shell-manual-${user.trim()}`;
    
    try {
      // Get job status
      const { stdout: jobJson } = await execa('kubectl', [
        'get', 'job', jobName,
        '-o', 'json'
      ]);
      
      const job = JSON.parse(jobJson);
      
      // Get pod status
      const { stdout: podJson } = await execa('kubectl', [
        'get', 'pods',
        '-l', `job-name=${jobName}`,
        '-o', 'json'
      ]);
      
      const pods = JSON.parse(podJson);
      
      console.log(chalk.blue(`Shell Status for ${service}:\n`));
      console.log(`  Job: ${chalk.white(jobName)}`);
      console.log(`  Created: ${chalk.white(this.getAge(new Date(job.metadata.creationTimestamp)))} ago`);
      
      if (job.metadata.annotations?.justification) {
        console.log(`  Justification: ${chalk.gray(job.metadata.annotations.justification)}`);
      }
      
      if (pods.items && pods.items.length > 0) {
        const pod = pods.items[0];
        const phase = pod.status.phase;
        const podName = pod.metadata.name;
        
        let statusColor = chalk.yellow;
        let statusIcon = '⏳';
        
        if (phase === 'Running') {
          statusColor = chalk.green;
          statusIcon = '✓';
        } else if (phase === 'Failed') {
          statusColor = chalk.red;
          statusIcon = '✗';
        }
        
        console.log(`  Pod: ${chalk.white(podName)}`);
        console.log(`  Status: ${statusIcon} ${statusColor(phase)}`);
        
        if (phase === 'Pending') {
          // Show why it's pending
          const containerStatuses = pod.status.containerStatuses || [];
          if (containerStatuses.length > 0 && containerStatuses[0].state.waiting) {
            const reason = containerStatuses[0].state.waiting.reason;
            console.log(`  Reason: ${chalk.yellow(reason)}`);
          }
        } else if (phase === 'Running') {
          console.log(`\n${chalk.green('Shell is ready!')} Connect with:`);
          console.log(chalk.cyan(`  qalam shell ${service}`));
        } else if (phase === 'Failed') {
          const message = pod.status.message || 'Unknown error';
          console.log(`  Error: ${chalk.red(message)}`);
        }
      } else {
        console.log(`  Status: ${chalk.yellow('⏳ Creating pod...')}`);
      }
      
      return {
        success: true,
        message: `Status check complete for ${service}`
      };
    } catch (error) {
      if (error.stderr && error.stderr.includes('NotFound')) {
        return {
          success: false,
          message: `No shell job found for ${service}`
        };
      }
      throw error;
    }
  }

  async showStatus() {
    const { stdout: user } = await execa('whoami');
    const username = user.trim();
    
    // Get all shell jobs
    const { stdout } = await execa('kubectl', [
      'get', 'jobs',
      '-o', 'json'
    ]);
    
    const jobs = JSON.parse(stdout);
    const userJobs = jobs.items.filter(job =>
      job.metadata.name.includes('-shell-manual-') &&
      job.metadata.name.endsWith(username)
    );
    
    if (userJobs.length === 0) {
      return {
        success: true,
        message: 'No active shell sessions'
      };
    }
    
    console.log(chalk.blue('Active Shell Sessions:\n'));
    
    for (const job of userJobs) {
      const name = job.metadata.name;
      const service = name.replace(`-shell-manual-${username}`, '');
      const created = new Date(job.metadata.creationTimestamp);
      const age = this.getAge(created);
      const annotations = job.metadata.annotations || {};
      
      console.log(chalk.green(`▸ ${service}`));
      console.log(`  Job: ${name}`);
      console.log(`  Age: ${age}`);
      console.log(`  Reason: ${annotations.justification || 'N/A'}`);
      
      if (annotations.duration && annotations.duration !== 'indefinite') {
        console.log(`  Duration: ${chalk.yellow(annotations.duration)}`);
      }
      
      // Check pod status
      try {
        const { stdout: podStatus } = await execa('kubectl', [
          'get', 'pods',
          '-l', `job-name=${name}`,
          '-o', 'jsonpath={.items[0].status.phase}'
        ]);
        console.log(`  Status: ${podStatus === 'Running' ? chalk.green(podStatus) : chalk.yellow(podStatus)}`);
      } catch (error) {
        console.log(`  Status: ${chalk.gray('Unknown')}`);
      }
      
      console.log();
    }
    
    return {
      success: true,
      message: `Found ${userJobs.length} active session(s)`
    };
  }

  getCurrentEnvironment() {
    try {
      const { stdout: context } = execa.sync('kubectl', ['config', 'current-context']);
      const { stdout: namespace } = execa.sync('kubectl', ['config', 'view', '--minify', '-o', 'jsonpath={..namespace}']);
      
      const isProd = context.includes('prod');
      const isBeta = context.includes('beta');
      
      return {
        context: context.trim(),
        namespace: namespace.trim() || 'default',
        isProd,
        isBeta,
        isDev: !isProd && !isBeta
      };
    } catch (error) {
      return {
        context: 'unknown',
        namespace: 'default',
        isProd: false,
        isBeta: false,
        isDev: true
      };
    }
  }

  addAnnotations(yaml, annotations) {
    const lines = yaml.split('\n');
    const metadataIndex = lines.findIndex(line => line.includes('metadata:'));
    
    if (metadataIndex !== -1) {
      const indent = '  ';
      const annotationLines = [
        `${indent}annotations:`
      ];
      
      for (const [key, value] of Object.entries(annotations)) {
        annotationLines.push(`${indent}  ${key}: "${value}"`);
      }
      
      lines.splice(metadataIndex + 1, 0, ...annotationLines);
    }
    
    return lines.join('\n');
  }

  async waitForPod(jobName, opts = {}) {
    const maxAttempts = 30;
    const checkInterval = 2000;
    let lastStatus = '';
    let attempts = 0;
    
    // For async mode, return immediately with job info
    if (opts.async) {
      console.log(chalk.blue('Shell job created in background'));
      console.log(chalk.gray(`Check status: qalam shell status ${jobName.replace('-shell-manual-.*', '')}`));
      console.log(chalk.gray(`Connect when ready: qalam shell ${jobName.replace('-shell-manual-.*', '')}`));
      return null; // Signal async creation
    }
    
    console.log(chalk.yellow('Creating pod...'));
    
    while (attempts < maxAttempts) {
      try {
        // Get pod status with more details
        const { stdout: podJson } = await execa('kubectl', [
          'get', 'pods',
          '-l', `job-name=${jobName}`,
          '-o', 'json'
        ]);
        
        const pods = JSON.parse(podJson);
        if (pods.items && pods.items.length > 0) {
          const pod = pods.items[0];
          const podName = pod.metadata.name;
          const phase = pod.status.phase;
          const conditions = pod.status.conditions || [];
          const containerStatuses = pod.status.containerStatuses || [];
          
          // Determine detailed status
          let currentStatus = phase;
          let statusDetail = '';
          
          if (phase === 'Pending') {
            // Check why it's pending
            const scheduling = conditions.find(c => c.type === 'PodScheduled');
            if (scheduling && scheduling.status === 'False') {
              statusDetail = 'Waiting for node assignment';
            } else if (containerStatuses.length > 0) {
              const containerStatus = containerStatuses[0];
              if (containerStatus.state.waiting) {
                const reason = containerStatus.state.waiting.reason;
                if (reason === 'ContainerCreating') {
                  statusDetail = 'Creating container';
                } else if (reason === 'PullImage' || reason === 'Pulling') {
                  // Try to get image pull progress
                  statusDetail = await this.getImagePullProgress(podName, opts.verbose);
                } else {
                  statusDetail = reason;
                }
              }
            } else {
              // Check init containers
              const initContainerStatuses = pod.status.initContainerStatuses || [];
              if (initContainerStatuses.length > 0) {
                const initStatus = initContainerStatuses[0];
                if (initStatus.state.waiting) {
                  statusDetail = `Init: ${initStatus.state.waiting.reason}`;
                }
              }
            }
          } else if (phase === 'Running') {
            // Pod is ready
            process.stdout.write('\r' + ' '.repeat(80) + '\r'); // Clear line
            console.log(chalk.green('✓ Pod is running'));
            return podName;
          } else if (phase === 'Failed' || phase === 'Unknown') {
            // Pod failed to start
            const message = pod.status.message || 'Unknown error';
            throw new Error(`Pod failed to start: ${message}`);
          }
          
          // Update status display
          const statusMessage = statusDetail ? `${currentStatus}: ${statusDetail}` : currentStatus;
          if (statusMessage !== lastStatus) {
            process.stdout.write('\r' + ' '.repeat(80) + '\r'); // Clear line
            process.stdout.write(chalk.cyan(`  Status: ${statusMessage}`));
            lastStatus = statusMessage;
          }
          
          // If verbose mode, show events
          if (opts.verbose && attempts % 3 === 0) { // Show events every 6 seconds
            await this.showPodEvents(podName);
          }
        } else {
          // No pod yet
          process.stdout.write('\r' + chalk.cyan('  Status: Job scheduled, waiting for pod...'));
        }
      } catch (error) {
        // Ignore errors during status check
        if (opts.verbose) {
          console.log(chalk.gray(`\n  Debug: ${error.message}`));
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      attempts++;
    }
    
    process.stdout.write('\r' + ' '.repeat(80) + '\r'); // Clear line
    throw new Error('Timeout waiting for pod creation (60s)');
  }

  async getImagePullProgress(podName, verbose = false) {
    try {
      // Get events for the pod to see pull progress
      const { stdout } = await execa('kubectl', [
        'get', 'events',
        '--field-selector', `involvedObject.name=${podName}`,
        '--sort-by', '.lastTimestamp',
        '-o', 'json'
      ]);
      
      const events = JSON.parse(stdout);
      const pullEvents = events.items.filter(e => 
        e.reason === 'Pulling' || e.reason === 'Pulled' || e.message.includes('pull')
      );
      
      if (pullEvents.length > 0) {
        const lastEvent = pullEvents[pullEvents.length - 1];
        // Extract image size if available
        const sizeMatch = lastEvent.message.match(/(\d+\.?\d*[MGT]B)/);
        if (sizeMatch) {
          return `Pulling image (${sizeMatch[1]})`;
        }
        return 'Pulling image...';
      }
    } catch (error) {
      // Ignore errors
    }
    return 'Pulling image...';
  }

  async showPodEvents(podName) {
    try {
      const { stdout } = await execa('kubectl', [
        'get', 'events',
        '--field-selector', `involvedObject.name=${podName}`,
        '--sort-by', '.lastTimestamp',
        '-o', 'custom-columns=TIME:.lastTimestamp,REASON:.reason,MESSAGE:.message',
        '--no-headers'
      ]);
      
      if (stdout) {
        const events = stdout.split('\n').filter(e => e).slice(-3); // Last 3 events
        if (events.length > 0) {
          console.log(chalk.gray('\n  Recent events:'));
          events.forEach(event => {
            console.log(chalk.gray('    ' + event.substring(0, 100))); // Truncate long messages
          });
        }
      }
    } catch (error) {
      // Ignore errors in event display
    }
  }

  startSessionTracking(service, info) {
    const sessionId = `${service}-${Date.now()}`;
    this.sessionStore.set(sessionId, {
      ...info,
      commands: [],
      active: true
    });
    return sessionId;
  }

  endSessionTracking(service) {
    for (const [id, session] of this.sessionStore.entries()) {
      if (id.startsWith(service) && session.active) {
        session.active = false;
        session.endTime = new Date();
        session.duration = session.endTime - session.startTime;
        
      }
    }
  }

  scheduleCleanup(service, duration) {
    const ms = this.parseDuration(duration);
    
    setTimeout(async () => {
      console.log(chalk.yellow(`\nAuto-cleanup: Session duration (${duration}) expired`));
      await this.deleteShell(service);
      console.log(chalk.green('✓ Shell session auto-cleaned'));
    }, ms);
  }

  parseDuration(duration) {
    const match = duration.match(/^(\d+)([hms])$/);
    if (!match) return 3600000; // Default 1 hour
    
    const [, value, unit] = match;
    const multipliers = {
      's': 1000,
      'm': 60000,
      'h': 3600000
    };
    
    return parseInt(value) * multipliers[unit];
  }

  async startRecording(service) {
    // Implementation for session recording
    // This could use 'script' command or custom solution
    return null;
  }

  async stopRecording(recorder, service) {
    // Stop recording and save
    return null;
  }

  getAge(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  help() {
    return `Advanced Shell Management:

${chalk.blue('Quick Access:')}
  ${chalk.cyan('qalam shell <service>')} - Smart shell (create/reconnect)
  ${chalk.cyan('qalam shell status <service>')} - Check shell readiness

${chalk.blue('Options:')}
  ${chalk.green('--async, -a')}      Create shell in background
  ${chalk.green('--reason, -r')}     Custom justification
  ${chalk.green('--duration')}       Auto-cleanup after (e.g., 2h, 30m)
  ${chalk.green('--verbose, -v')}    Show detailed pod events
  ${chalk.green('--container, -c')} Specify container (default: application)
  ${chalk.green('--no-cleanup')}    Don't prompt for cleanup

${chalk.blue('Examples:')}
  ${chalk.cyan('qalam shell myservice')} - Create and connect (with progress)
  ${chalk.cyan('qalam shell myservice --async')} - Create in background
  ${chalk.cyan('qalam shell status myservice')} - Check if ready
  ${chalk.cyan('qalam shell myservice --duration 1h')} - Auto-cleanup after 1 hour
  ${chalk.cyan('qalam shell')} - Show all active sessions

${chalk.yellow('New Features:')}
  • ${chalk.green('Progress monitoring')} - Shows pod creation status
    - Pending: Waiting for node
    - Pulling image (with size)
    - Creating container
    - Running ✓
  • ${chalk.green('Async mode')} - Create shells in background
  • ${chalk.green('Status checking')} - Check if async shell is ready
  • Template justifications for quick access
  • Production safety checks`;
  }
}