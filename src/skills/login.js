import { Skill } from '../core/skillManager.js';
import { execa } from 'execa';
import chalk from 'chalk';
import ora from 'ora';
import { Config } from '../core/config.js';

export default class LoginSkill extends Skill {
  constructor() {
    super('login', 'Start your day - AWS authentication and default cluster setup');
    this.config = new Config();
  }

  async execute(args) {
    let profile = process.env.AWS_PROFILE || 'default';
    let method = 'auto'; // auto, sso, or vault
    
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--vault') {
        method = 'vault';
      } else if (args[i] === '--sso') {
        method = 'sso';
      } else if (!args[i].startsWith('--')) {
        profile = args[i];
      }
    }
    
    const spinner = ora('Starting your day...').start();
    
    try {
      spinner.text = 'Checking AWS authentication...';
      const isAuthenticated = await this.authenticateAWS(profile, method);
      if (isAuthenticated) {
        spinner.succeed('AWS authentication successful');
      } else {
        spinner.fail('AWS authentication failed');
        return {
          success: false,
          message: 'Authentication failed. Please try again.'
        };
      }
      
      // Show status
      console.log(chalk.green('\n✓ Day started successfully!\n'));
      await this.showStatus();
      
      // Save login time
      this.config.set('login-time', new Date().toISOString());
      
      return {
        success: true,
        message: 'Logged in successfully'
      };
    } catch (error) {
      spinner.fail('Login failed');
      return {
        success: false,
        message: `Login failed: ${error.message}`
      };
    }
  }

  async authenticateAWS(profile, method = 'auto') {
    const awsProfile = profile || process.env.AWS_PROFILE || 'default';
    
    // Check if AWS credentials are already loaded
    try {
      const { stdout } = await execa('aws', ['sts', 'get-caller-identity']);
      const identity = JSON.parse(stdout);
      console.log(chalk.gray(`  Already authenticated as: ${identity.Arn.split('/').pop()}`));
      return true;
    } catch (error) {
      // Not authenticated yet
    }
    
    console.log(chalk.yellow('\n  Starting AWS authentication...'));
    
    // Skip SSO if user explicitly wants vault
    if (method === 'vault') {
      console.log(chalk.blue('  Using awsvault (will open Keychain)...'));
    } else {
      // Method 1: Try using aws sso login directly (preferred for qalam)
      try {
      console.log(chalk.gray('  Using AWS SSO login...'));
      
      // Set the AWS_PROFILE for SSO
      process.env.AWS_PROFILE = awsProfile;
      
      // First check if the profile exists in AWS config
      try {
        await execa('aws', ['configure', 'get', 'sso_start_url', '--profile', awsProfile]);
      } catch (error) {
        console.log(chalk.yellow('\n  AWS SSO profile not configured'));
        console.log(chalk.blue('  Would you like to use awsvault instead? (This will open Keychain)'));
        // Skip to awsvault method
        throw new Error('Profile not configured for SSO');
      }
      
      // Create a promise to handle the interactive SSO flow
      const ssoPromise = new Promise((resolve, reject) => {
        const ssoProcess = execa('aws', ['sso', 'login', '--profile', awsProfile, '--no-browser']);
        
        let urlCaptured = false;
        
        // Capture stderr/stdout for the SSO URL
        const handleOutput = (data) => {
          const output = data.toString();
          
          // Look for the SSO URL - but only process once
          if (!urlCaptured && output.includes('http')) {
            // AWS SSO shows the portal URL with /start
            const patterns = [
              /https:\/\/[^\s]*awsapps\.com\/start[^\s]*/,  // SSO portal
              /https:\/\/device\.sso\.[^\s]+/,              // Device auth
              /https:\/\/[^\s]+\/oauth\/authorize[^\s]*/,   // OAuth flow
              /https:\/\/[^\s]+verification[^\s]*/          // Verification
            ];
            
            for (const pattern of patterns) {
              const match = output.match(pattern);
              if (match) {
                const url = match[0];
                urlCaptured = true;  // Set flag immediately
                
                console.log(chalk.cyan('\n  Please authenticate in your browser:'));
                console.log(chalk.white(`\n  ${url}\n`));
                break;
              }
            }
            
            // Also check for user code pattern (some SSO setups show a code instead)
            const codeMatch = output.match(/code:\s*([A-Z0-9-]+)/i);
            if (codeMatch && !urlCaptured) {
              console.log(chalk.cyan('\n  Enter this code in your browser:'));
              console.log(chalk.white(`\n  ${codeMatch[1]}\n`));
            }
          }
          
          // Pass through other output
          if (!output.includes('https://')) {
            process.stdout.write(chalk.gray(output));
          }
        };
        
        ssoProcess.stdout?.on('data', handleOutput);
        ssoProcess.stderr?.on('data', handleOutput);
        
        ssoProcess.then(() => {
          console.log(chalk.green('\n  SSO authentication completed'));
          resolve(true);
        }).catch(reject);
      });
      
      await ssoPromise;
      
      // Verify credentials work
      const { stdout } = await execa('aws', ['sts', 'get-caller-identity']);
      const identity = JSON.parse(stdout);
      console.log(chalk.green(`  ✓ Authenticated as: ${identity.Arn.split('/').pop()}`));
      return true;
      
      } catch (ssoError) {
        console.log(chalk.yellow('  SSO login failed, trying awsvault...'));
      }
    }
    
    // Method 2: Fall back to awsvault with credential export
    try {
      console.log(chalk.gray('  Using awsvault...'));
      
      // Run awsvault and export credentials as JSON
      const { stdout } = await new Promise((resolve, reject) => {
        const proc = execa('sh', ['-c', 
          `awsvault exec ${awsProfile} -- aws configure export-credentials`
        ]);
        
        let urlShown = false;
        let lastUrl = null;
        proc.stderr?.on('data', (data) => {
          const output = data.toString();
          
          // Look for SSO URL
          if (!urlShown && output.includes('http')) {
            const urlMatch = output.match(/https:\/\/[^\s]+/);
            if (urlMatch && !urlShown) {
              const url = urlMatch[0];
              // Only process if it's a different URL
              if (url !== lastUrl) {
                urlShown = true;
                lastUrl = url;
                console.log(chalk.cyan('\n  Please authenticate in your browser:'));
                console.log(chalk.white(`\n  ${url}\n`));
                console.log(chalk.gray('  Waiting for authentication...'));
              }
            }
          }
        });
        
        proc.then(resolve).catch(reject);
      });
      
      // Parse and set credentials
      const creds = JSON.parse(stdout);
      process.env.AWS_ACCESS_KEY_ID = creds.AccessKeyId;
      process.env.AWS_SECRET_ACCESS_KEY = creds.SecretAccessKey;
      process.env.AWS_SESSION_TOKEN = creds.SessionToken;
      process.env.AWS_REGION = creds.Region || 'eu-west-1';
      
      // Verify it worked
      const { stdout: verifyOut } = await execa('aws', ['sts', 'get-caller-identity']);
      const identity = JSON.parse(verifyOut);
      console.log(chalk.green(`\n  ✓ Authenticated via awsvault as: ${identity.Arn.split('/').pop()}`));
      return true;
      
    } catch (error) {
      console.log(chalk.red('\n  Authentication failed'));
      console.log(chalk.gray(`  Error: ${error.message}`));
      return false;
    }
  }

  async setupCluster(cluster, namespace) {
    // Add timeout for kubectl commands
    const timeout = 15000; // 15 seconds
    
    // This function is currently unused but kept for reference
    const clusterConfigs = {
      'dev': { 
        fullName: process.env.DEV_CLUSTER_NAME || 'dev-eks-cluster',
        region: process.env.DEV_CLUSTER_REGION || 'us-west-2',
        account: process.env.DEV_AWS_ACCOUNT || '000000000000',
        defaultNamespace: process.env.DEV_DEFAULT_NAMESPACE || 'default'
      },
      'staging': { 
        fullName: process.env.STAGING_CLUSTER_NAME || 'staging-eks-cluster',
        region: process.env.STAGING_CLUSTER_REGION || 'us-east-1',
        account: process.env.STAGING_AWS_ACCOUNT || '000000000000',
        defaultNamespace: process.env.STAGING_DEFAULT_NAMESPACE || 'default'
      },
      'prod': { 
        fullName: process.env.PROD_CLUSTER_NAME || 'prod-eks-cluster',
        region: process.env.PROD_CLUSTER_REGION || 'us-east-1',
        account: process.env.PROD_AWS_ACCOUNT || '000000000000',
        defaultNamespace: process.env.PROD_DEFAULT_NAMESPACE || 'default'
      }
    };
    
    const config = clusterConfigs[cluster];
    if (!config) {
      throw new Error(`Unknown cluster: ${cluster}`);
    }
    
    // We should already be in an awsvault session if we got here
    // Just run the update-kubeconfig directly with timeout
    try {
      await execa('aws', [
        'eks', 'update-kubeconfig',
        '--name', config.fullName,
        '--region', config.region
      ], { timeout });
    } catch (error) {
      if (error.timedOut) {
        throw new Error(`Timeout updating kubeconfig for ${cluster}. Check your AWS credentials.`);
      }
      throw error;
    }
    
    // Set namespace (doesn't need AWS creds)
    if (namespace) {
      try {
        await execa('kubens', [namespace]);
      } catch (error) {
        await execa('kubectl', ['config', 'set-context', '--current', '--namespace=' + namespace]);
      }
    }
  }

  getDefaultNamespace(cluster) {
    const defaults = {
      'dev': process.env.DEV_DEFAULT_NAMESPACE || 'default',
      'staging': process.env.STAGING_DEFAULT_NAMESPACE || 'default',
      'prod': process.env.PROD_DEFAULT_NAMESPACE || 'default'
    };
    return defaults[cluster] || 'default';
  }

  async showStatus() {
    try {
      // Get AWS identity
      const { stdout: identity } = await execa('aws', ['sts', 'get-caller-identity']);
      const awsInfo = JSON.parse(identity);
      const user = awsInfo.Arn.split('/').pop();
      
      console.log(chalk.blue('Current Status:'));
      console.log(`  AWS User: ${chalk.white(user)}`);
      console.log(`  Account: ${chalk.white(awsInfo.Account)}`);
      console.log(chalk.gray('\n  Use "qalam cluster <name>" to switch clusters'));
    } catch (error) {
      console.log(chalk.yellow('  Unable to get AWS status'));
    }
  }

  help() {
    return `Start Your Day:

${chalk.blue('Usage:')}
  ${chalk.cyan('qalam login')} - Start with default profile and last cluster
  ${chalk.cyan('qalam login prod')} - Start with prod AWS profile

${chalk.yellow('What it does:')}
  1. Authenticates with AWS (awsvault)
  2. Sets up last used cluster (or beta by default)
  3. Configures kubectl context
  4. Shows current status

${chalk.gray('Tip: Your last cluster/namespace choice is remembered')}`;
  }
}