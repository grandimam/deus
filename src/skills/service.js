import { Skill } from "../core/skillManager.js";
import { execa } from "execa";
import chalk from "chalk";
import path from "path";
import fs from "fs/promises";

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
      return {
        success: false,
        message:
          "Service command required. Available: " +
          Object.keys(this.commands).join(", "),
      };
    }

    try {
      // Check if dev-conf directory exists
      await this.checkDevConfExists();

      switch (command) {
        case "start":
          return await this.startService(params);
        case "stop":
          return await this.stopService(params);
        case "restart":
          return await this.restartService(params);
        case "status":
          return await this.serviceStatus(params);
        case "logs":
          return await this.viewLogs(params);
        case "list":
          return await this.listServices();
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

  help() {
    const commands = Object.entries(this.commands)
      .map(
        ([cmd, desc]) => `  ${chalk.green(cmd.padEnd(10))} ${chalk.gray(desc)}`
      )
      .join("\n");

    return (
      `Service skill commands:\n${commands}\n\nExamples:\n` +
      `  ${chalk.cyan("qalam service list")} - List all available services\n` +
      `  ${chalk.cyan(
        "qalam service start property-lpv-service"
      )} - Start property-lpv-service and related workers\n` +
      `  ${chalk.cyan(
        "qalam service logs property-lpv-service"
      )} - View service logs\n` +
      `  ${chalk.cyan("qalam service ps")} - List all running services`
    );
  }
}
