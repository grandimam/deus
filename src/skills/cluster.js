import { Skill } from '../core/skillManager.js';
import { execa } from 'execa';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { Config } from '../core/config.js';

export default class ClusterSkill extends Skill {
  constructor() {
    super('cluster', 'Switch between Kubernetes clusters and namespaces');
    this.config = new Config();
    
    this.clusters = {
      'dev': {
        name: process.env.DEV_CLUSTER_NAME || 'dev-eks-cluster',
        region: process.env.DEV_CLUSTER_REGION || 'us-west-2',
        account: process.env.DEV_AWS_ACCOUNT || '000000000000',
        namespaces: (process.env.DEV_NAMESPACES || 'default').split(','),
        defaultNamespace: process.env.DEV_DEFAULT_NAMESPACE || 'default'
      },
      'staging': {
        name: process.env.STAGING_CLUSTER_NAME || 'staging-eks-cluster',
        region: process.env.STAGING_CLUSTER_REGION || 'us-east-1',
        account: process.env.STAGING_AWS_ACCOUNT || '000000000000',
        namespaces: (process.env.STAGING_NAMESPACES || 'default').split(','),
        defaultNamespace: process.env.STAGING_DEFAULT_NAMESPACE || 'default'
      },
      'prod': {
        name: process.env.PROD_CLUSTER_NAME || 'prod-eks-cluster',
        region: process.env.PROD_CLUSTER_REGION || 'us-east-1',
        account: process.env.PROD_AWS_ACCOUNT || '000000000000',
        namespaces: (process.env.PROD_NAMESPACES || 'default').split(','),
        defaultNamespace: process.env.PROD_DEFAULT_NAMESPACE || 'default'
      }
    };
  }

  async execute(args) {
    const [action, ...params] = args;
    
    if (!action) {
      return await this.showCurrentCluster();
    }
    
    // Check if action is 'switch' or a direct cluster name
    if (action === 'switch') {
      const [cluster, namespace] = params;
      return await this.switchCluster(cluster, namespace);
    } else if (this.clusters[action]) {
      // Direct cluster name provided
      return await this.switchCluster(action, params[0]);
    } else {
      return {
        success: false,
        message: `Unknown cluster: ${action}. Available: ${Object.keys(this.clusters).join(', ')}`
      };
    }
  }

  async switchCluster(clusterAlias, namespace) {
    if (!clusterAlias) {
      // Show interactive cluster selection
      return await this.interactiveSwitch();
    }
    
    const cluster = this.clusters[clusterAlias];
    if (!cluster) {
      return {
        success: false,
        message: `Unknown cluster: ${clusterAlias}. Available: ${Object.keys(this.clusters).join(', ')}`
      };
    }
    
    const spinner = ora(`Switching to ${clusterAlias}...`).start();
    
    try {
      // Update kubeconfig
      spinner.text = `Updating kubeconfig for ${clusterAlias}...`;
      const contextName = `arn:aws:eks:${cluster.region}:${cluster.account}:cluster/${cluster.name}`;
      
      // Check if context exists
      try {
        await execa('kubectl', ['config', 'get-contexts', contextName]);
      } catch (error) {
        // Context doesn't exist, update kubeconfig
        await execa('aws', [
          'eks', 'update-kubeconfig',
          '--name', cluster.name,
          '--region', cluster.region
        ]);
      }
      
      // Switch to context
      await execa('kubectl', ['config', 'use-context', contextName]);
      
      // Handle namespace selection
      let targetNamespace = namespace;
      
      if (!targetNamespace) {
        // Check if cluster has multiple namespaces
        if (cluster.namespaces.length > 1) {
          spinner.stop();
          
          // Check for remembered namespace
          const lastNamespace = this.config.get(`last-namespace-${clusterAlias}`);
          
          const { selectedNamespace } = await inquirer.prompt([{
            type: 'list',
            name: 'selectedNamespace',
            message: `Select namespace for ${clusterAlias}:`,
            choices: [
              ...cluster.namespaces.map(ns => ({
                name: ns === lastNamespace ? `${ns} (last used)` : ns,
                value: ns
              })),
              { name: 'List all namespaces', value: '__list__' }
            ],
            default: lastNamespace || cluster.defaultNamespace
          }]);
          
          if (selectedNamespace === '__list__') {
            // List all namespaces from cluster
            const { stdout } = await execa('kubectl', ['get', 'namespaces', '-o', 'jsonpath={.items[*].metadata.name}']);
            const allNamespaces = stdout.split(' ').filter(ns => ns);
            
            const { selected } = await inquirer.prompt([{
              type: 'list',
              name: 'selected',
              message: 'Select from all namespaces:',
              choices: allNamespaces,
              pageSize: 20
            }]);
            targetNamespace = selected;
          } else {
            targetNamespace = selectedNamespace;
          }
          
          spinner.start('Switching namespace...');
        } else {
          targetNamespace = cluster.defaultNamespace;
        }
      }
      
      // Switch namespace
      if (targetNamespace) {
        try {
          // Try kubens first
          await execa('kubens', [targetNamespace]);
        } catch (error) {
          // Fallback to kubectl
          await execa('kubectl', ['config', 'set-context', '--current', '--namespace=' + targetNamespace]);
        }
      }
      
      spinner.succeed(`Switched to ${clusterAlias}`);
      
      // Save preferences
      this.config.set('last-cluster', clusterAlias);
      if (targetNamespace) {
        this.config.set(`last-namespace-${clusterAlias}`, targetNamespace);
      }
      
      // Show status
      console.log(chalk.blue('\nCurrent Configuration:'));
      console.log(`  Cluster: ${chalk.white(clusterAlias)}`);
      console.log(`  Region: ${chalk.white(cluster.region)}`);
      console.log(`  Namespace: ${chalk.white(targetNamespace || 'default')}`);
      
      // Quick connectivity check
      try {
        const { stdout } = await execa('kubectl', ['get', 'nodes', '--no-headers']);
        const nodeCount = stdout.split('\n').filter(n => n).length;
        console.log(`  Status: ${chalk.green('✓ Connected')} (${nodeCount} nodes)`);
      } catch (error) {
        console.log(`  Status: ${chalk.yellow('⚠ Check authentication')}`);
      }
      
      return {
        success: true,
        message: `Switched to ${clusterAlias} cluster`,
        output: `Namespace: ${targetNamespace || 'default'}`
      };
    } catch (error) {
      spinner.fail(`Failed to switch to ${clusterAlias}`);
      
      if (error.message.includes('aws') || error.message.includes('expired')) {
        return {
          success: false,
          message: 'AWS credentials expired. Run: qalam login'
        };
      }
      
      return {
        success: false,
        message: `Failed to switch cluster: ${error.message}`
      };
    }
  }

  async interactiveSwitch() {
    const currentCluster = await this.getCurrentCluster();
    
    const { cluster } = await inquirer.prompt([{
      type: 'list',
      name: 'cluster',
      message: 'Select cluster:',
      choices: Object.keys(this.clusters).map(key => ({
        name: key === currentCluster ? `${key} (current)` : key,
        value: key
      }))
    }]);
    
    return await this.switchCluster(cluster);
  }

  async showCurrentCluster() {
    try {
      const { stdout: context } = await execa('kubectl', ['config', 'current-context']);
      const { stdout: namespace } = await execa('kubectl', ['config', 'view', '--minify', '-o', 'jsonpath={..namespace}']);
      
      // Identify cluster from context
      let currentCluster = 'unknown';
      for (const [alias, config] of Object.entries(this.clusters)) {
        if (context.includes(config.name)) {
          currentCluster = alias;
          break;
        }
      }
      
      console.log(chalk.blue('Current Cluster Configuration:'));
      console.log(`  Cluster: ${chalk.white(currentCluster)}`);
      console.log(`  Context: ${chalk.gray(context.trim())}`);
      console.log(`  Namespace: ${chalk.white(namespace || 'default')}`);
      
      // Show available clusters
      console.log(chalk.blue('\nAvailable Clusters:'));
      Object.entries(this.clusters).forEach(([alias, config]) => {
        const isCurrent = alias === currentCluster;
        console.log(`  ${isCurrent ? chalk.green('→') : ' '} ${chalk.white(alias.padEnd(12))} ${chalk.gray(`(${config.region})`)} ${isCurrent ? chalk.green('← current') : ''}`);
      });
      
      console.log(chalk.gray('\nSwitch with: qalam cluster <name>'));
      
      return {
        success: true,
        message: 'Current cluster information displayed'
      };
    } catch (error) {
      return {
        success: false,
        message: 'No active cluster context. Run: qalam login'
      };
    }
  }

  async getCurrentCluster() {
    try {
      const { stdout: context } = await execa('kubectl', ['config', 'current-context']);
      
      for (const [alias, config] of Object.entries(this.clusters)) {
        if (context.includes(config.name)) {
          return alias;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  help() {
    return `Cluster Management:

${chalk.blue('Usage:')}
  ${chalk.cyan('qalam cluster')} - Show current cluster
  ${chalk.cyan('qalam cluster beta')} - Switch to beta (will prompt for namespace)
  ${chalk.cyan('qalam cluster beta beta-bid')} - Switch to beta with beta-bid namespace
  ${chalk.cyan('qalam cluster prod')} - Switch to production
  ${chalk.cyan('qalam cluster space')} - Switch to dev space

${chalk.blue('Available Clusters:')}
  ${chalk.green('dev')}     - Development environment
  ${chalk.green('staging')} - Staging environment
  ${chalk.green('prod')}    - Production environment

${chalk.yellow('Features:')}
  • Remembers last used namespace per cluster
  • Auto-detects available namespaces
  • Shows cluster connectivity status
  • Handles expired credentials gracefully`;
  }
}