import { Skill } from "../core/skillManager.js";
import { execa } from "execa";
import chalk from "chalk";
import path from "path";
import fs from "fs/promises";
import inquirer from "inquirer";

export default class ServiceSkill extends Skill {
  constructor() {
    super("service", "Manage development services (docker-compose)");
    this.commands = {
      start: "Start a service",
      stop: "Stop a service",
      restart: "Restart a service",
      status: "Check service status",
      logs: "View service logs",
      list: "List all available services",
      ps: "List running services",
    };

    // Path to dev-conf directory (assuming it's in the workspace)
    this.devConfPath = path.join(process.cwd(), "../dev-conf");
    this.dockerComposePath = path.join(this.devConfPath, "docker-compose.yml");
  }

  async execute(args) {
    const [command, ...params] = args;

    if (!command) {
      return await this.interactiveMenu();
    }

    try {
      // Check if dev-conf directory exists
      await this.checkDevConfExists();

      switch (command) {
        case "start":
          if (params.length === 0) {
            return await this.interactiveSelectService('start');
          }
          return await this.startService(params);
        case "stop":
          if (params.length === 0) {
            return await this.interactiveSelectService('stop');
          }
          return await this.stopService(params);
        case "restart":
          if (params.length === 0) {
            return await this.interactiveSelectService('restart');
          }
          return await this.restartService(params);
        case "status":
          if (params.length === 0) {
            return await this.interactiveSelectService('status');
          }
          return await this.serviceStatus(params);
        case "logs":
          if (params.length === 0) {
            return await this.interactiveSelectService('logs');
          }
          return await this.viewLogs(params);
        case "list":
        case "ls":
          return await this.interactiveListServices();
        case "ps":
          return await this.listRunning();
        default:
          return {
            success: false,
            message: `Unknown command: ${command}. Available: ${Object.keys(
              this.commands
            ).join(", ")}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Service error: ${error.message}`,
      };
    }
  }

  async checkDevConfExists() {
    try {
      await fs.access(this.dockerComposePath);
    } catch {
      throw new Error(
        `dev-conf docker-compose.yml not found at ${this.dockerComposePath}`
      );
    }
  }

  async startService(params) {
    if (params.length === 0) {
      return {
        success: false,
        message:
          "Service name required. Example: qalam service start property-lpv-service",
      };
    }

    const serviceName = params[0];

    // Handle special cases for services with consumers and celery workers
    const relatedServices = this.getRelatedServices(serviceName);

    const { stdout } = await execa(
      "docker",
      ["compose", "-f", this.dockerComposePath, "up", "-d", ...relatedServices],
      {
        cwd: this.devConfPath,
      }
    );

    return {
      success: true,
      message: `Started service(s): ${relatedServices.join(", ")}`,
      output: stdout,
    };
  }

  async stopService(params) {
    if (params.length === 0) {
      return {
        success: false,
        message:
          "Service name required. Example: qalam service stop property-lpv-service",
      };
    }

    const serviceName = params[0];
    const relatedServices = this.getRelatedServices(serviceName);

    const { stdout } = await execa(
      "docker",
      ["compose", "-f", this.dockerComposePath, "stop", ...relatedServices],
      {
        cwd: this.devConfPath,
      }
    );

    return {
      success: true,
      message: `Stopped service(s): ${relatedServices.join(", ")}`,
      output: stdout,
    };
  }

  async restartService(params) {
    if (params.length === 0) {
      return {
        success: false,
        message:
          "Service name required. Example: qalam service restart property-lpv-service",
      };
    }

    const serviceName = params[0];
    const relatedServices = this.getRelatedServices(serviceName);

    const { stdout } = await execa(
      "docker",
      ["compose", "-f", this.dockerComposePath, "restart", ...relatedServices],
      {
        cwd: this.devConfPath,
      }
    );

    return {
      success: true,
      message: `Restarted service(s): ${relatedServices.join(", ")}`,
      output: stdout,
    };
  }

  async serviceStatus(params) {
    if (params.length === 0) {
      return {
        success: false,
        message:
          "Service name required. Example: qalam service status property-lpv-service",
      };
    }

    const serviceName = params[0];
    const relatedServices = this.getRelatedServices(serviceName);

    const { stdout } = await execa(
      "docker",
      ["compose", "-f", this.dockerComposePath, "ps", ...relatedServices],
      {
        cwd: this.devConfPath,
      }
    );

    return {
      success: true,
      message: `Status for ${serviceName}:`,
      output: stdout,
    };
  }

  async viewLogs(params) {
    if (params.length === 0) {
      return {
        success: false,
        message:
          "Service name required. Example: qalam service logs property-lpv-service",
      };
    }

    const [serviceName, ...options] = params;
    const args = ["compose", "-f", this.dockerComposePath, "logs"];

    // Add tail option if not specified
    if (!options.includes("--tail")) {
      args.push("--tail", "50");
    } else {
      args.push(...options);
    }

    // Add follow option if specified
    if (options.includes("-f") || options.includes("--follow")) {
      args.push("-f");
    }

    args.push(serviceName);

    const { stdout } = await execa("docker", args, {
      cwd: this.devConfPath,
    });

    return {
      success: true,
      message: `Logs for ${serviceName}:`,
      output: stdout,
    };
  }

  async listServices() {
    // Parse docker-compose.yml to get all services
    const { stdout } = await execa(
      "docker",
      ["compose", "-f", this.dockerComposePath, "config", "--services"],
      {
        cwd: this.devConfPath,
      }
    );

    const services = stdout.split("\n").filter((s) => s.trim());

    // Group services by base name
    const serviceGroups = {};
    services.forEach((service) => {
      const baseName = service.replace(/-consumer$|-celery$/, "");
      if (!serviceGroups[baseName]) {
        serviceGroups[baseName] = [];
      }
      serviceGroups[baseName].push(service);
    });

    let output = "Available services:\n\n";
    Object.entries(serviceGroups).forEach(([base, related]) => {
      if (related.length === 1) {
        output += `  ${chalk.green(base)}\n`;
      } else {
        output += `  ${chalk.green(base)} (+ ${related
          .filter((s) => s !== base)
          .join(", ")})\n`;
      }
    });

    return {
      success: true,
      message: "Services from dev-conf:",
      output,
    };
  }

  async listRunning() {
    const { stdout } = await execa(
      "docker",
      ["compose", "-f", this.dockerComposePath, "ps", "--format", "table"],
      {
        cwd: this.devConfPath,
      }
    );

    return {
      success: true,
      message: "Running services:",
      output: stdout,
    };
  }

  getRelatedServices(serviceName) {
    const services = [serviceName];

    if (
      !serviceName.endsWith("-consumer") &&
      !serviceName.endsWith("-celery")
    ) {
      services.push(`${serviceName}-consumer`);
      services.push(`${serviceName}-celery`);
    }

    return services;
  }

  async interactiveMenu() {
    try {
      await this.checkDevConfExists();
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }

    const choices = [
      { name: 'Start a service', value: 'start' },
      { name: 'Stop a service', value: 'stop' },
      { name: 'Restart a service', value: 'restart' },
      { name: 'Check service status', value: 'status' },
      { name: 'View service logs', value: 'logs' },
      { name: 'List all services', value: 'list' },
      { name: 'List running services', value: 'ps' },
      { name: 'Exit', value: '__exit__' }
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Service Management:',
        choices: choices
      }
    ]);

    if (action === '__exit__') {
      return { success: true };
    }

    if (action === 'ps') {
      return await this.listRunning();
    }

    if (action === 'list') {
      return await this.interactiveListServices();
    }

    return await this.interactiveSelectService(action);
  }

  async interactiveSelectService(action) {
    // Get all available services
    const { stdout } = await execa(
      "docker",
      ["compose", "-f", this.dockerComposePath, "config", "--services"],
      {
        cwd: this.devConfPath,
      }
    );

    const services = stdout.split("\n").filter((s) => s.trim());
    
    // Group services by base name
    const serviceGroups = {};
    services.forEach((service) => {
      const baseName = service.replace(/-consumer$|-celery$/, "");
      if (!serviceGroups[baseName]) {
        serviceGroups[baseName] = [];
      }
      serviceGroups[baseName].push(service);
    });

    // Build choices for selection
    const choices = [];
    Object.entries(serviceGroups).forEach(([base, related]) => {
      if (related.length === 1) {
        choices.push({
          name: chalk.green(base),
          value: base
        });
      } else {
        choices.push({
          name: `${chalk.green(base)} ${chalk.gray(`(+ ${related.filter(s => s !== base).join(', ')})`)}`,
          value: base
        });
      }
    });

    choices.push(new inquirer.Separator());
    choices.push({ name: chalk.gray('Cancel'), value: '__cancel__' });

    const actionText = {
      start: 'start',
      stop: 'stop',
      restart: 'restart',
      status: 'check status of',
      logs: 'view logs for'
    };

    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: `Select service to ${actionText[action]}:`,
        choices: choices,
        pageSize: 15
      }
    ]);

    if (selected === '__cancel__') {
      return { success: true };
    }

    // Execute the action
    switch (action) {
      case 'start':
        return await this.startService([selected]);
      case 'stop':
        return await this.stopService([selected]);
      case 'restart':
        return await this.restartService([selected]);
      case 'status':
        return await this.serviceStatus([selected]);
      case 'logs':
        // For logs, ask for additional options
        const { follow } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'follow',
            message: 'Follow log output (live updates)?',
            default: false
          }
        ]);
        const options = follow ? ['-f'] : [];
        return await this.viewLogs([selected, ...options]);
    }
  }

  async interactiveListServices() {
    // Parse docker-compose.yml to get all services
    const { stdout } = await execa(
      "docker",
      ["compose", "-f", this.dockerComposePath, "config", "--services"],
      {
        cwd: this.devConfPath,
      }
    );

    const services = stdout.split("\n").filter((s) => s.trim());

    // Group services by base name
    const serviceGroups = {};
    services.forEach((service) => {
      const baseName = service.replace(/-consumer$|-celery$/, "");
      if (!serviceGroups[baseName]) {
        serviceGroups[baseName] = [];
      }
      serviceGroups[baseName].push(service);
    });

    console.log(chalk.blue('Available Services:\n'));
    Object.entries(serviceGroups).forEach(([base, related]) => {
      if (related.length === 1) {
        console.log(`  ${chalk.green(base)}`);
      } else {
        console.log(`  ${chalk.green(base)} ${chalk.gray(`(+ ${related.filter(s => s !== base).join(', ')})}`)}`);
      }
    });

    console.log(chalk.gray('\nUsage:'));
    console.log(chalk.gray('  Start service:'), chalk.cyan('qalam service start'));
    console.log(chalk.gray('  Quick start:'), chalk.cyan('qalam service start <name>'));

    return {
      success: true,
      message: `Found ${Object.keys(serviceGroups).length} services`
    };
  }

  help() {
    const commands = Object.entries(this.commands)
      .map(
        ([cmd, desc]) => `  ${chalk.green(cmd.padEnd(10))} ${chalk.gray(desc)}`
      )
      .join("\n");

    return (
      `${chalk.blue('Service Management - Docker Compose')}\n\n` +
      `${chalk.yellow('Interactive Mode:')}\n` +
      `  ${chalk.cyan("qalam service")}                  Interactive menu\n` +
      `  ${chalk.cyan("qalam service start")}            Select service to start\n` +
      `  ${chalk.cyan("qalam service list")}             List all services\n\n` +
      `${chalk.yellow('Direct Usage:')}\n` +
      `  ${chalk.cyan("qalam service start <name>")}     Start specific service\n` +
      `  ${chalk.cyan("qalam service stop <name>")}      Stop specific service\n` +
      `  ${chalk.cyan("qalam service logs <name>")}      View service logs\n` +
      `  ${chalk.cyan("qalam service ps")}               List running services`
    );
  }
}
