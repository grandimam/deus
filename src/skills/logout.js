import { Skill } from '../core/skillManager.js';
import { execa } from 'execa';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { Config } from '../core/config.js';

export default class LogoutSkill extends Skill {
  constructor() {
    super('logout', 'End your day - cleanup shells and clear authentication');
    this.config = new Config();
  }

  async execute(args) {
    const spinner = ora('Ending your day...').start();
    
    try {
      // Step 1: Check for active shells
      spinner.text = 'Checking for active shells...';
      const activeShells = await this.getActiveShells();
      
      if (activeShells.length > 0) {
        spinner.stop();
        console.log(chalk.yellow(`\nFound ${activeShells.length} active shell session(s):`));
        activeShells.forEach(shell => {
          console.log(`  • ${chalk.white(shell.name)}`);
          if (shell.justification) {
            console.log(`    Reason: ${chalk.gray(shell.justification)}`);
          }
        });
        
        const { cleanup } = await inquirer.prompt([{
          type: 'confirm',
          name: 'cleanup',
          message: 'Clean up all shell sessions?',
          default: true
        }]);
        
        if (cleanup) {
          spinner.start('Cleaning up shells...');
          await this.cleanupShells(activeShells);
          spinner.succeed('Shell sessions cleaned up');
        }
      } else {
        spinner.succeed('No active shells found');
      }
      
      // Step 2: Show session summary
      await this.showSessionSummary();
      
      // Step 3: Clear sensitive data (optional)
      const { clearAuth } = await inquirer.prompt([{
        type: 'confirm',
        name: 'clearAuth',
        message: 'Clear AWS credentials cache?',
        default: false
      }]);
      
      if (clearAuth) {
        spinner.start('Clearing credentials...');
        await this.clearCredentials();
        spinner.succeed('Credentials cleared');
      }
      
      console.log(chalk.green('\n✓ Day ended successfully!'));
      console.log(chalk.gray('See you tomorrow! 👋\n'));
      
      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      spinner.fail('Logout failed');
      return {
        success: false,
        message: `Logout error: ${error.message}`
      };
    }
  }

  async getActiveShells() {
    try {
      const { stdout: user } = await execa('whoami');
      const username = user.trim();
      
      const { stdout } = await execa('kubectl', [
        'get', 'jobs',
        '-o', 'json'
      ]);
      
      const jobs = JSON.parse(stdout);
      const userShells = jobs.items
        .filter(job => job.metadata.name.includes(`-shell-manual-${username}`))
        .map(job => ({
          name: job.metadata.name,
          created: job.metadata.creationTimestamp,
          justification: job.metadata.annotations?.justification
        }));
      
      return userShells;
    } catch (error) {
      return [];
    }
  }

  async cleanupShells(shells) {
    for (const shell of shells) {
      try {
        await execa('kubectl', ['delete', 'job', shell.name]);
      } catch (error) {
        // Ignore individual deletion errors
      }
    }
  }

  async showSessionSummary() {
    const loginTime = this.config.get('login-time');
    if (loginTime) {
      const start = new Date(loginTime);
      const now = new Date();
      const duration = Math.floor((now - start) / 1000);
      
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      
      console.log(chalk.blue('\nSession Summary:'));
      console.log(`  Duration: ${chalk.white(`${hours}h ${minutes}m`)}`);
      
    }
  }

  async clearCredentials() {
    // Clear AWS credentials from environment
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_SESSION_TOKEN;
    
    // Clear config cache
    this.config.delete('login-time');
    this.config.delete('last-cluster');
    
    // Note: aws-vault credentials will expire on their own
  }

  help() {
    return `End Your Day:

${chalk.blue('Usage:')}
  ${chalk.cyan('qalam logout')} - End day with cleanup

${chalk.yellow('What it does:')}
  1. Lists active shell sessions
  2. Offers to clean up shells
  3. Shows session summary
  4. Optionally clears credentials

${chalk.gray('Tip: Always logout to clean up resources')}`;
  }
}