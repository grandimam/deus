import { Skill } from '../core/skillManager.js';
import chalk from 'chalk';
import { getDatabase } from '../core/database.js';
import ora from 'ora';
import fs from 'fs/promises';
import inquirer from 'inquirer';

export default class HttpSkill extends Skill {
  constructor() {
    super('http', 'HTTP client with Postman import');
    this.db = null;
    this.variables = {};
  }

  async init() {
    if (!this.db) {
      this.db = await getDatabase();
      await this.loadVariables();
    }
  }

  async execute(args) {
    await this.init();
    
    const [action, ...params] = args;

    switch (action) {
      case 'import':
        return await this.importCollection(params[0]);
      
      case 'list':
      case 'ls':
        return await this.interactiveSelectAndRun();
      
      case 'run':
        return await this.runRequest(params.join(' '));
      
      case 'set':
        return await this.setVariable(params[0], params.slice(1).join(' '));
      
      case 'vars':
      case 'variables':
        return await this.showVariables();
      
      case 'delete':
      case 'rm':
        return await this.deleteRequest(params.join(' '));
      
      case 'clear':
        return await this.clearAll();
      
      default:
        // Try to run as request name
        if (action) {
          const requestName = [action, ...params].join(' ');
          return await this.runRequest(requestName);
        }
        
        // No args - show interactive menu
        return await this.interactiveMenu();
    }
  }

  async importCollection(filePath) {
    if (!filePath) {
      return {
        success: false,
        message: 'File path required: qalam http import <collection.json>'
      };
    }

    const spinner = ora('Importing Postman collection...').start();

    try {
      // Read the Postman collection file
      const content = await fs.readFile(filePath, 'utf-8');
      const collection = JSON.parse(content);

      // Extract collection info
      const collectionName = collection.info?.name || 'Imported Collection';
      let importedCount = 0;
      let skippedCount = 0;

      // Extract variables if present
      if (collection.variable && Array.isArray(collection.variable)) {
        for (const variable of collection.variable) {
          this.variables[variable.key] = variable.value;
        }
        await this.saveVariables();
      }

      // Process items recursively (handles folders)
      const processItems = async (items, folderPath = '') => {
        for (const item of items) {
          if (item.item && Array.isArray(item.item)) {
            // It's a folder
            const newPath = folderPath ? `${folderPath}/${item.name}` : item.name;
            await processItems(item.item, newPath);
          } else if (item.request) {
            // It's a request
            const requestName = folderPath ? `${folderPath}/${item.name}` : item.name;
            
            try {
              await this.savePostmanRequest(requestName, item.request, collectionName);
              importedCount++;
            } catch (error) {
              // Skip if duplicate
              skippedCount++;
            }
          }
        }
      };

      if (collection.item && Array.isArray(collection.item)) {
        await processItems(collection.item);
      }

      spinner.stop();

      console.log(chalk.green('✓'), `Imported "${collectionName}"`);
      console.log(chalk.gray(`  Requests: ${importedCount} imported`));
      if (skippedCount > 0) {
        console.log(chalk.gray(`  Skipped: ${skippedCount} (duplicates)`));
      }
      if (Object.keys(this.variables).length > 0) {
        console.log(chalk.gray(`  Variables: ${Object.keys(this.variables).length} found`));
        console.log(chalk.gray(`    ${Object.keys(this.variables).slice(0, 3).join(', ')}${Object.keys(this.variables).length > 3 ? '...' : ''}`));
      }
      
      console.log(chalk.cyan('\nUsage:'));
      console.log(chalk.gray('  List requests:'), chalk.white('qalam http list'));
      console.log(chalk.gray('  Run request:'), chalk.white('qalam http "<request name>"'));

      return {
        success: true,
        message: `Imported ${importedCount} requests from ${collectionName}`
      };
    } catch (error) {
      spinner.stop();
      return {
        success: false,
        message: `Import failed: ${error.message}`
      };
    }
  }

  async savePostmanRequest(name, request, collectionName) {
    // Parse the request URL
    let url = '';
    if (typeof request.url === 'string') {
      url = request.url;
    } else if (request.url?.raw) {
      url = request.url.raw;
    } else if (request.url?.host && request.url?.path) {
      // Reconstruct URL from parts
      const host = Array.isArray(request.url.host) ? request.url.host.join('.') : request.url.host;
      const path = Array.isArray(request.url.path) ? request.url.path.join('/') : request.url.path;
      url = `${host}/${path}`;
      
      // Add protocol if not present
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
    }

    // Extract headers
    const headers = {};
    if (request.header && Array.isArray(request.header)) {
      for (const header of request.header) {
        if (header.key && !header.disabled) {
          headers[header.key] = header.value;
        }
      }
    }

    // Extract body
    let body = null;
    if (request.body) {
      if (request.body.raw) {
        body = request.body.raw;
      } else if (request.body.urlencoded) {
        // Convert urlencoded to object
        const params = {};
        for (const param of request.body.urlencoded) {
          if (!param.disabled) {
            params[param.key] = param.value;
          }
        }
        body = JSON.stringify(params);
      } else if (request.body.formdata) {
        // Store formdata as special format
        body = JSON.stringify({
          _type: 'formdata',
          data: request.body.formdata.filter(f => !f.disabled)
        });
      }
    }

    // Save to database
    const requestData = {
      method: request.method || 'GET',
      url: url,
      headers: headers,
      body: body,
      collection: collectionName
    };

    await this.db.saveCommand(
      `http:${name}`,
      JSON.stringify(requestData),
      `${request.method || 'GET'} ${url}`,
      'postman'
    );
  }

  async listRequests(filter) {
    try {
      const requests = await this.db.searchCommands('http:');
      
      if (requests.length === 0) {
        console.log(chalk.yellow('No imported requests'));
        console.log(chalk.gray('Import a Postman collection:'), chalk.cyan('qalam http import <collection.json>'));
        return {
          success: true,
          message: 'No requests found'
        };
      }

      // Store requests for potential use
      this.requestList = [];
      
      // Group by collection
      const collections = {};
      for (const req of requests) {
        const name = req.name.replace('http:', '');
        const data = JSON.parse(req.command);
        
        if (filter && !name.toLowerCase().includes(filter.toLowerCase())) {
          continue;
        }
        
        const collection = data.collection || 'Unknown';
        if (!collections[collection]) {
          collections[collection] = [];
        }
        collections[collection].push({ name, method: data.method, url: data.url });
        this.requestList.push({ name, method: data.method, url: data.url, collection });
      }

      // Display grouped requests
      for (const [collection, reqs] of Object.entries(collections)) {
        console.log(chalk.blue(`\n${collection}:`));
        for (const req of reqs) {
          const method = req.method.padEnd(6);
          const methodColor = 
            req.method === 'GET' ? chalk.green :
            req.method === 'POST' ? chalk.yellow :
            req.method === 'DELETE' ? chalk.red :
            req.method === 'PUT' ? chalk.blue :
            chalk.cyan;
          
          console.log(`  ${methodColor(method)} ${chalk.white(req.name)}`);
        }
      }

      console.log(chalk.gray('\nUsage:'));
      console.log(chalk.gray('  Interactive:'), chalk.cyan('qalam http list'));
      console.log(chalk.gray('  Run by name:'), chalk.cyan('qalam http "<request name>"'));
      
      return {
        success: true,
        message: `Found ${this.requestList.length} requests`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to list requests: ${error.message}`
      };
    }
  }

  async runRequest(name) {
    if (!name) {
      return {
        success: false,
        message: 'Request name required'
      };
    }

    try {
      // Try exact match first
      let request = await this.db.getCommand(`http:${name}`);
      
      // If not found, try case-insensitive search
      if (!request) {
        const allRequests = await this.db.searchCommands('http:');
        const matches = allRequests.filter(r => 
          r.name.replace('http:', '').toLowerCase() === name.toLowerCase()
        );
        
        if (matches.length > 0) {
          request = matches[0];
        } else {
          // Try partial match
          const partialMatches = allRequests.filter(r => 
            r.name.replace('http:', '').toLowerCase().includes(name.toLowerCase())
          );
          
          if (partialMatches.length === 1) {
            request = partialMatches[0];
          } else if (partialMatches.length > 1) {
            console.log(chalk.yellow(`Multiple matches for "${name}":`));
            partialMatches.slice(0, 5).forEach(r => {
              console.log(chalk.cyan(`  ${r.name.replace('http:', '')}`));
            });
            return {
              success: false,
              message: 'Please be more specific'
            };
          } else {
            console.log(chalk.red(`Request "${name}" not found`));
            console.log(chalk.gray('Use'), chalk.cyan('qalam http list'), chalk.gray('to see available requests'));
            return {
              success: false,
              message: `Request "${name}" not found`
            };
          }
        }
      }

      const requestData = JSON.parse(request.command);
      const requestName = request.name.replace('http:', '');
      
      // Replace variables in URL
      let url = this.replaceVariables(requestData.url);
      
      // Replace variables in headers
      const headers = {};
      for (const [key, value] of Object.entries(requestData.headers || {})) {
        headers[key] = this.replaceVariables(value);
      }
      
      // Replace variables in body
      let body = requestData.body;
      if (body) {
        body = this.replaceVariables(body);
      }

      const spinner = ora(`${requestData.method} ${requestName}`).start();

      try {
        const startTime = Date.now();
        
        const fetchOptions = {
          method: requestData.method,
          headers: headers,
        };

        // Add body for non-GET requests
        if (body && requestData.method !== 'GET') {
          // Check if it's form data
          try {
            const parsed = JSON.parse(body);
            if (parsed._type === 'formdata') {
              // Handle form data specially
              console.log(chalk.yellow('Note: FormData not fully supported yet'));
              fetchOptions.body = body;
            } else {
              fetchOptions.body = body;
            }
          } catch {
            fetchOptions.body = body;
          }
        }

        const response = await fetch(url, fetchOptions);
        const elapsed = Date.now() - startTime;
        
        spinner.stop();

        // Parse response
        const contentType = response.headers.get('content-type');
        let responseBody;
        
        if (contentType?.includes('application/json')) {
          responseBody = await response.json();
        } else {
          responseBody = await response.text();
        }

        // Display result
        const statusColor = response.ok ? chalk.green : chalk.red;
        console.log(statusColor(`${response.status} ${response.statusText}`), chalk.gray(`(${elapsed}ms)`));
        
        // Display response body
        if (typeof responseBody === 'object') {
          console.log(JSON.stringify(responseBody, null, 2));
        } else {
          // Truncate long text responses
          const text = responseBody.substring(0, 500);
          console.log(text);
          if (responseBody.length > 500) {
            console.log(chalk.gray('... (truncated)'));
          }
        }

        return {
          success: response.ok,
          message: `${response.status} ${response.statusText}`,
          data: responseBody
        };
      } catch (error) {
        spinner.stop();
        console.log(chalk.red('✗'), `Request failed: ${error.message}`);
        
        if (error.message.includes('fetch')) {
          console.log(chalk.gray('Check that the URL is reachable:'), url);
        }
        
        return {
          success: false,
          message: error.message
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to run request: ${error.message}`
      };
    }
  }

  replaceVariables(text) {
    if (!text) return text;
    
    // Replace {{variable}} pattern with actual values
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return this.variables[key] || match;
    });
  }

  async setVariable(key, value) {
    if (!key) {
      return {
        success: false,
        message: 'Usage: qalam http set <key> <value>'
      };
    }

    this.variables[key] = value;
    await this.saveVariables();
    
    console.log(chalk.green('✓'), `Variable set: ${key} = ${value}`);
    
    return {
      success: true,
      message: `Variable ${key} set`
    };
  }

  async showVariables() {
    if (Object.keys(this.variables).length === 0) {
      console.log(chalk.yellow('No variables set'));
      console.log(chalk.gray('Set a variable:'), chalk.cyan('qalam http set <key> <value>'));
      return {
        success: true
      };
    }

    console.log(chalk.blue('Variables:'));
    for (const [key, value] of Object.entries(this.variables)) {
      console.log(chalk.cyan(`  ${key}:`), value);
    }
    
    return {
      success: true
    };
  }

  async deleteRequest(name) {
    if (!name) {
      return {
        success: false,
        message: 'Request name required'
      };
    }

    try {
      const deleted = await this.db.deleteCommand(`http:${name}`);
      
      if (deleted) {
        console.log(chalk.green('✓'), `Request "${name}" deleted`);
        return {
          success: true,
          message: `Request deleted`
        };
      } else {
        return {
          success: false,
          message: `Request "${name}" not found`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete: ${error.message}`
      };
    }
  }

  async clearAll() {
    try {
      const requests = await this.db.searchCommands('http:');
      
      if (requests.length === 0) {
        console.log(chalk.yellow('No requests to clear'));
        return { success: true };
      }

      for (const req of requests) {
        await this.db.deleteCommand(req.name);
      }
      
      console.log(chalk.green('✓'), `Cleared ${requests.length} requests`);
      
      return {
        success: true,
        message: `Cleared ${requests.length} requests`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to clear: ${error.message}`
      };
    }
  }

  async saveVariables() {
    await this.db.setConfig('http_variables', this.variables);
  }

  async loadVariables() {
    const saved = await this.db.getConfig('http_variables');
    if (saved) {
      this.variables = saved;
    }
  }


  async interactiveSelectAndRun() {
    // Load requests first
    const requests = await this.db.searchCommands('http:');
    
    if (requests.length === 0) {
      console.log(chalk.yellow('No imported requests'));
      console.log(chalk.gray('Import a Postman collection:'), chalk.cyan('qalam http import <collection.json>'));
      return {
        success: true,
        message: 'No requests found'
      };
    }

    // Build choices for inquirer
    const choices = [];
    const collections = {};
    
    for (const req of requests) {
      const name = req.name.replace('http:', '');
      const data = JSON.parse(req.command);
      const collection = data.collection || 'Unknown';
      
      if (!collections[collection]) {
        collections[collection] = [];
      }
      
      // Color code the method
      const methodColor = 
        data.method === 'GET' ? chalk.green :
        data.method === 'POST' ? chalk.yellow :
        data.method === 'DELETE' ? chalk.red :
        data.method === 'PUT' ? chalk.blue :
        data.method === 'PATCH' ? chalk.magenta :
        chalk.cyan;
      
      collections[collection].push({
        name: `${methodColor(data.method.padEnd(7))} ${chalk.white(name)}`,
        value: name,
        short: name
      });
    }

    // Add choices grouped by collection
    for (const [collection, reqs] of Object.entries(collections)) {
      choices.push(new inquirer.Separator(chalk.blue(`── ${collection} ──`)));
      choices.push(...reqs);
    }

    const { selectedRequest } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedRequest',
        message: 'Select a request to run:',
        choices: choices,
        pageSize: 20
      }
    ]);

    // Run the selected request
    return await this.runRequest(selectedRequest);
  }

  async interactiveMenu() {
    // Load requests first
    const requests = await this.db.searchCommands('http:');
    
    if (requests.length === 0) {
      console.log(chalk.yellow('No imported requests'));
      console.log(chalk.gray('Import a Postman collection:'), chalk.cyan('qalam http import <collection.json>'));
      return {
        success: true,
        message: 'No requests found'
      };
    }

    // Build choices for inquirer
    const choices = [];
    const collections = {};
    
    for (const req of requests) {
      const name = req.name.replace('http:', '');
      const data = JSON.parse(req.command);
      const collection = data.collection || 'Unknown';
      
      if (!collections[collection]) {
        collections[collection] = [];
      }
      
      // Color code the method
      const methodColor = 
        data.method === 'GET' ? chalk.green :
        data.method === 'POST' ? chalk.yellow :
        data.method === 'DELETE' ? chalk.red :
        data.method === 'PUT' ? chalk.blue :
        data.method === 'PATCH' ? chalk.magenta :
        chalk.cyan;
      
      collections[collection].push({
        name: `${methodColor(data.method.padEnd(7))} ${chalk.white(name)}`,
        value: name,
        short: name
      });
    }

    // Add choices grouped by collection
    for (const [collection, reqs] of Object.entries(collections)) {
      choices.push(new inquirer.Separator(chalk.blue(`\n── ${collection} ──`)));
      choices.push(...reqs);
    }

    // Add management options
    choices.push(new inquirer.Separator(chalk.gray('\n── Options ──')));
    choices.push({ name: 'Import collection', value: '__import__' });
    choices.push({ name: 'Manage variables', value: '__variables__' });
    choices.push({ name: 'Exit', value: '__exit__' });

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Select a request to run:',
        choices: choices,
        pageSize: 15
      }
    ]);

    switch (action) {
      case '__import__':
        const { filepath } = await inquirer.prompt([
          {
            type: 'input',
            name: 'filepath',
            message: 'Enter path to Postman collection JSON:'
          }
        ]);
        return await this.importCollection(filepath);
      
      case '__variables__':
        return await this.manageVariablesInteractive();
      
      case '__exit__':
        console.log(chalk.gray('Exiting...'));
        return { success: true };
      
      default:
        return await this.runRequest(action);
    }
  }

  async manageVariablesInteractive() {
    const choices = [
      { name: 'View variables', value: 'view' },
      { name: 'Set a variable', value: 'set' },
      { name: 'Back', value: 'back' }
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Variable management:',
        choices: choices
      }
    ]);

    switch (action) {
      case 'view':
        return await this.showVariables();
      
      case 'set':
        const { key, value } = await inquirer.prompt([
          {
            type: 'input',
            name: 'key',
            message: 'Variable name:'
          },
          {
            type: 'input',
            name: 'value',
            message: 'Variable value:'
          }
        ]);
        return await this.setVariable(key, value);
      
      default:
        return { success: true };
    }
  }

  help() {
    const helpText = `
${chalk.blue('HTTP Client - Postman Import for CLI')}

${chalk.yellow('Interactive Mode:')}
  ${chalk.cyan('qalam http')}                         Interactive menu with all options
  ${chalk.cyan('qalam http list')}                    Select and run from list

${chalk.yellow('Import Collections:')}
  ${chalk.cyan('qalam http import collection.json')} Import Postman collection

${chalk.yellow('Direct Execution:')}
  ${chalk.cyan('qalam http "Login"')}                 Run request by name
  ${chalk.cyan('qalam http "Users/Get All"')}        Run request with folder path

${chalk.yellow('Variables:')}
  ${chalk.cyan('qalam http set base_url http://localhost:3000')}
  ${chalk.cyan('qalam http set token abc123')}
  ${chalk.cyan('qalam http vars')}                    Show all variables

${chalk.yellow('Management:')}
  ${chalk.cyan('qalam http delete "Login"')}          Delete a request
  ${chalk.cyan('qalam http clear')}                   Delete all requests`;

    console.log(helpText);
    
    return {
      success: true,
      message: 'Help displayed'
    };
  }
}