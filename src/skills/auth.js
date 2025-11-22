import { Skill } from '../core/skillManager.js';
import { execa } from 'execa';
import chalk from 'chalk';
import ora from 'ora';

export default class AuthSkill extends Skill {
  constructor() {
    super('auth', 'AWS and Kubernetes authentication management');
    this.credentialCache = new Map();
    this.lastAuthTime = null;
    this.authExpiryMinutes = 60; // Default token expiry
  }

  async execute(args) {
    const [command, ...params] = args;

    if (!command) {
      return await this.checkAuthStatus();
    }

    try {
      switch (command) {
        case 'login':
        case 'aws':
          return await this.awsLogin(params);
        case 'status':
          return await this.checkAuthStatus();
        case 'refresh':
          return await this.refreshCredentials();
        case 'cluster':
          return await this.updateClusterConfig(params);
        case 'verify':
          return await this.verifyAccess();
        default:
          return await this.awsLogin([command, ...params]);
      }
    } catch (error) {
      return {
        success: false,
        message: `Auth error: ${error.message}`
      };
    }
  }

  async awsLogin(params) {
    const spinner = ora('Authenticating with AWS...').start();
    
    try {
      // Check if awsvault is available
      const vaultCommand = await this.getVaultCommand();
      
      if (!vaultCommand) {
        spinner.fail('AWS vault tool not found');
        return {
          success: false,
          message: 'Please install aws-vault or configure awsvault alias'
        };
      }

      // Execute vault command
      const profile = params[0] || 'default';
      
      // Try to execute the vault command
      if (vaultCommand === 'my-aws-vault') {
        // Use the custom vault command
        await execa.command(`${vaultCommand} exec ${profile} -- aws sts get-caller-identity`, {
          shell: true
        });
      } else {
        // Standard aws-vault
        await execa('aws-vault', ['exec', profile, '--', 'aws', 'sts', 'get-caller-identity']);
      }

      spinner.succeed('AWS authentication successful');
      
      // Update last auth time
      this.lastAuthTime = new Date();
      this.credentialCache.set('aws', {
        profile,
        authenticated: true,
        timestamp: this.lastAuthTime
      });

      // Auto-update kubeconfig for current context
      const context = await this.getCurrentContext();
      if (context) {
        spinner.start('Updating kubeconfig...');
        await this.updateKubeconfig(context);
        spinner.succeed(`Kubeconfig updated for ${context.cluster}`);
      }

      return {
        success: true,
        message: `Authenticated with AWS profile: ${profile}`,
        output: `Token expires in ~${this.authExpiryMinutes} minutes\nContext: ${context?.cluster || 'none'}`
      };
    } catch (error) {
      spinner.fail('Authentication failed');
      throw error;
    }
  }

  async checkAuthStatus() {
    console.log(chalk.blue('Authentication Status:\n'));
    
    // Check AWS credentials
    const awsStatus = await this.checkAWSStatus();
    console.log(chalk.yellow('AWS:'));
    if (awsStatus.authenticated) {
      console.log(`  ${chalk.green('✓')} Authenticated`);
      console.log(`  Profile: ${awsStatus.profile}`);
      console.log(`  Age: ${awsStatus.age}`);
      if (awsStatus.expired) {
        console.log(`  ${chalk.red('⚠')} Token may be expired`);
      }
    } else {
      console.log(`  ${chalk.red('✗')} Not authenticated`);
    }
    
    // Check Kubernetes access
    console.log(chalk.yellow('\nKubernetes:'));
    const k8sStatus = await this.checkK8sStatus();
    if (k8sStatus.accessible) {
      console.log(`  ${chalk.green('✓')} Cluster accessible`);
      console.log(`  Context: ${k8sStatus.context}`);
      console.log(`  Namespace: ${k8sStatus.namespace}`);
    } else {
      console.log(`  ${chalk.red('✗')} Cluster not accessible`);
      console.log(`  ${chalk.gray('Run: qalam auth login')}`);
    }

    return {
      success: true,
      message: 'Status check complete'
    };
  }

  async refreshCredentials() {
    const spinner = ora('Refreshing credentials...').start();
    
    try {
      // Get cached credentials
      const awsCreds = this.credentialCache.get('aws');
      
      if (!awsCreds) {
        spinner.fail('No cached credentials found');
        return {
          success: false,
          message: 'Please run: qalam auth login'
        };
      }

      // Re-authenticate with same profile
      await this.awsLogin([awsCreds.profile]);
      
      spinner.succeed('Credentials refreshed');
      return {
        success: true,
        message: 'Credentials refreshed successfully'
      };
    } catch (error) {
      spinner.fail('Refresh failed');
      throw error;
    }
  }

  async updateClusterConfig(params) {
    const [cluster, region] = params;
    
    if (!cluster) {
      return {
        success: false,
        message: 'Cluster name required'
      };
    }

    const spinner = ora(`Updating config for ${cluster}...`).start();
    
    try {
      // Detect region from cluster name or use provided
      const clusterRegion = region || this.detectRegion(cluster);
      
      await execa('aws', [
        'eks', 'update-kubeconfig',
        '--name', cluster,
        '--region', clusterRegion
      ]);

      spinner.succeed(`Kubeconfig updated for ${cluster}`);
      
      // Test connection
      const { stdout: context } = await execa('kubectl', ['config', 'current-context']);
      
      return {
        success: true,
        message: `Connected to cluster: ${cluster}`,
        output: `Context: ${context.trim()}\nRegion: ${clusterRegion}`
      };
    } catch (error) {
      spinner.fail('Failed to update kubeconfig');
      throw error;
    }
  }

  async verifyAccess() {
    const spinner = ora('Verifying access...').start();
    
    try {
      // Check AWS
      const { stdout: awsIdentity } = await execa('aws', ['sts', 'get-caller-identity']);
      const identity = JSON.parse(awsIdentity);
      
      // Check Kubernetes
      const { stdout: k8sAuth } = await execa('kubectl', ['auth', 'can-i', 'get', 'pods']);
      
      spinner.succeed('Access verified');
      
      return {
        success: true,
        message: 'Access verification complete',
        output: `AWS Account: ${identity.Account}\nUser: ${identity.Arn.split('/').pop()}\nKubernetes: ${k8sAuth.trim()}`
      };
    } catch (error) {
      spinner.fail('Access verification failed');
      
      // Provide helpful error message
      if (error.message.includes('aws')) {
        return {
          success: false,
          message: 'AWS credentials expired. Run: qalam auth login'
        };
      } else if (error.message.includes('kubectl')) {
        return {
          success: false,
          message: 'Kubernetes access failed. Run: qalam auth cluster <cluster-name>'
        };
      }
      
      throw error;
    }
  }

  async checkAWSStatus() {
    const cached = this.credentialCache.get('aws');
    
    if (!cached) {
      return { authenticated: false };
    }

    const age = this.getAge(cached.timestamp);
    const minutesOld = (new Date() - cached.timestamp) / 60000;
    const expired = minutesOld > this.authExpiryMinutes;

    // Try to verify with actual AWS call
    try {
      await execa('aws', ['sts', 'get-caller-identity'], { timeout: 5000 });
      return {
        authenticated: true,
        profile: cached.profile,
        age,
        expired: false
      };
    } catch (error) {
      return {
        authenticated: true,
        profile: cached.profile,
        age,
        expired: true
      };
    }
  }

  async checkK8sStatus() {
    try {
      const { stdout: context } = await execa('kubectl', ['config', 'current-context']);
      const { stdout: namespace } = await execa('kubectl', ['config', 'view', '--minify', '-o', 'jsonpath={..namespace}']);
      
      // Try to list pods to verify access
      await execa('kubectl', ['get', 'pods', '--no-headers'], { timeout: 5000 });
      
      return {
        accessible: true,
        context: context.trim(),
        namespace: namespace.trim() || 'default'
      };
    } catch (error) {
      return { accessible: false };
    }
  }

  async getCurrentContext() {
    try {
      const { stdout } = await execa('kubectl', ['config', 'current-context']);
      const context = stdout.trim();
      
      // Parse cluster name from context
      // Format: arn:aws:eks:region:account:cluster/cluster-name
      const match = context.match(/cluster\/(.+)$/);
      const cluster = match ? match[1] : context;
      
      return { context, cluster };
    } catch (error) {
      return null;
    }
  }

  async updateKubeconfig(context) {
    // Parse cluster and region from context
    const match = context.context.match(/eks:([^:]+):.*cluster\/(.+)$/);
    
    if (match) {
      const [, region, cluster] = match;
      await execa('aws', [
        'eks', 'update-kubeconfig',
        '--name', cluster,
        '--region', region
      ]);
    }
  }

  async getVaultCommand() {
    // Check for different vault commands
    try {
      // Check for alias
      const { stdout } = await execa.command('alias awsvault', { shell: true });
      if (stdout.includes('my-aws-vault')) {
        return 'my-aws-vault';
      }
    } catch (error) {
      // Alias not found
    }

    // Check for aws-vault
    try {
      await execa('which', ['aws-vault']);
      return 'aws-vault';
    } catch (error) {
      // aws-vault not found
    }

    return null;
  }

  detectRegion(cluster) {
    // Common region patterns
    const regionMap = {
      'prod': 'eu-west-1',
      'beta': 'eu-west-1',
      'space': 'eu-west-1',
      'space-me': 'me-central-1',
      'space-gold': 'me-central-1'
    };

    for (const [key, region] of Object.entries(regionMap)) {
      if (cluster.includes(key)) {
        return region;
      }
    }

    // Default region
    return 'eu-west-1';
  }

  getAge(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  help() {
    return `AWS & Kubernetes Authentication:

${chalk.blue('Commands:')}
  ${chalk.green('login')}    Authenticate with AWS vault
  ${chalk.green('status')}   Check authentication status
  ${chalk.green('refresh')}  Refresh expired credentials
  ${chalk.green('cluster')}  Update kubeconfig for cluster
  ${chalk.green('verify')}   Verify AWS and K8s access

${chalk.blue('Examples:')}
  ${chalk.cyan('qalam auth')} - Check current status
  ${chalk.cyan('qalam auth login')} - Login with default profile
  ${chalk.cyan('qalam auth login prod')} - Login with prod profile
  ${chalk.cyan('qalam auth cluster beta-eks-cluster')}
  ${chalk.cyan('qalam auth refresh')} - Refresh expired tokens

${chalk.yellow('Features:')}
  • Auto-detects expired credentials
  • Updates kubeconfig after AWS login
  • Caches authentication state
  • Smart region detection`;
  }
}