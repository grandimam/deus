import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

export class Database {
  constructor() {
    this.dbPath = path.join(os.homedir(), '.qalam', 'qalam.db');
    this.db = null;
  }

  async init() {
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    await fs.mkdir(dir, { recursive: true });

    // Open database connection
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });

    // Enable foreign keys
    await this.db.run('PRAGMA foreign_keys = ON');

    // Create tables
    await this.createTables();
  }

  async createTables() {
    // Commands/Snippets table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        command TEXT NOT NULL,
        description TEXT,
        tags TEXT,
        usage_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used DATETIME
      )
    `);

    // Workflows table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        parallel BOOLEAN DEFAULT 0,
        continue_on_error BOOLEAN DEFAULT 0,
        variables TEXT, -- JSON string
        execution_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_executed DATETIME
      )
    `);

    // Workflow commands table (one-to-many relationship)
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_id INTEGER NOT NULL,
        command TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      )
    `);

    // Sessions table (for tracking work sessions)
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        duration INTEGER -- in seconds
      )
    `);

    // Configuration table (key-value store)
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_commands_name ON commands(name);
      CREATE INDEX IF NOT EXISTS idx_commands_tags ON commands(tags);
      CREATE INDEX IF NOT EXISTS idx_workflows_name ON workflows(name);
      CREATE INDEX IF NOT EXISTS idx_workflow_commands_workflow ON workflow_commands(workflow_id);
    `);
  }

  // Command/Memory methods
  async saveCommand(name, command, description = '', tags = '') {
    const result = await this.db.run(
      `INSERT OR REPLACE INTO commands (name, command, description, tags, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [name, command, description, tags]
    );
    return result.lastID;
  }

  async getCommand(name) {
    const command = await this.db.get(
      'SELECT * FROM commands WHERE name = ?',
      [name]
    );
    
    if (command) {
      // Update usage stats
      await this.db.run(
        `UPDATE commands 
         SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP 
         WHERE name = ?`,
        [name]
      );
    }
    
    return command;
  }

  async searchCommands(query) {
    return await this.db.all(
      `SELECT * FROM commands 
       WHERE name LIKE ? OR command LIKE ? OR description LIKE ? OR tags LIKE ?
       ORDER BY usage_count DESC, updated_at DESC
       LIMIT 20`,
      [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]
    );
  }

  async listCommands(limit = 50) {
    return await this.db.all(
      'SELECT * FROM commands ORDER BY updated_at DESC LIMIT ?',
      [limit]
    );
  }

  async deleteCommand(name) {
    const result = await this.db.run(
      'DELETE FROM commands WHERE name = ?',
      [name]
    );
    return result.changes > 0;
  }

  // Workflow methods
  async saveWorkflow(name, commands, options = {}) {
    const tx = await this.db.run('BEGIN TRANSACTION');
    
    try {
      // Insert or update workflow
      const result = await this.db.run(
        `INSERT OR REPLACE INTO workflows 
         (name, description, parallel, continue_on_error, variables, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          name,
          options.description || '',
          options.parallel ? 1 : 0,
          options.continueOnError ? 1 : 0,
          JSON.stringify(options.variables || {})
        ]
      );
      
      const workflowId = result.lastID;
      
      // Delete existing commands for this workflow if updating
      if (!workflowId) {
        const existing = await this.db.get(
          'SELECT id FROM workflows WHERE name = ?',
          [name]
        );
        if (existing) {
          await this.db.run(
            'DELETE FROM workflow_commands WHERE workflow_id = ?',
            [existing.id]
          );
          workflowId = existing.id;
        }
      }
      
      // Insert workflow commands
      for (let i = 0; i < commands.length; i++) {
        await this.db.run(
          `INSERT INTO workflow_commands (workflow_id, command, order_index)
           VALUES (?, ?, ?)`,
          [workflowId, commands[i], i]
        );
      }
      
      await this.db.run('COMMIT');
      return workflowId;
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }

  async getWorkflow(name) {
    const workflow = await this.db.get(
      'SELECT * FROM workflows WHERE name = ?',
      [name]
    );
    
    if (workflow) {
      // Get commands for this workflow
      const commands = await this.db.all(
        `SELECT command FROM workflow_commands 
         WHERE workflow_id = ? 
         ORDER BY order_index`,
        [workflow.id]
      );
      
      workflow.commands = commands.map(c => c.command);
      workflow.variables = JSON.parse(workflow.variables || '{}');
      
      // Update execution stats
      await this.db.run(
        `UPDATE workflows 
         SET execution_count = execution_count + 1, last_executed = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [workflow.id]
      );
    }
    
    return workflow;
  }

  async listWorkflows() {
    const workflows = await this.db.all(
      'SELECT * FROM workflows ORDER BY updated_at DESC'
    );
    
    // Get command count for each workflow
    for (const workflow of workflows) {
      const count = await this.db.get(
        'SELECT COUNT(*) as count FROM workflow_commands WHERE workflow_id = ?',
        [workflow.id]
      );
      workflow.commandCount = count.count;
      workflow.variables = JSON.parse(workflow.variables || '{}');
    }
    
    return workflows;
  }

  async deleteWorkflow(name) {
    const result = await this.db.run(
      'DELETE FROM workflows WHERE name = ?',
      [name]
    );
    return result.changes > 0;
  }

  async searchWorkflows(query) {
    const workflows = await this.db.all(
      `SELECT * FROM workflows 
       WHERE name LIKE ? OR description LIKE ?
       ORDER BY execution_count DESC, updated_at DESC`,
      [`%${query}%`, `%${query}%`]
    );
    
    for (const workflow of workflows) {
      const count = await this.db.get(
        'SELECT COUNT(*) as count FROM workflow_commands WHERE workflow_id = ?',
        [workflow.id]
      );
      workflow.commandCount = count.count;
      workflow.variables = JSON.parse(workflow.variables || '{}');
    }
    
    return workflows;
  }

  // Config methods
  async setConfig(key, value) {
    await this.db.run(
      `INSERT OR REPLACE INTO config (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [key, JSON.stringify(value)]
    );
  }

  async getConfig(key) {
    const result = await this.db.get(
      'SELECT value FROM config WHERE key = ?',
      [key]
    );
    return result ? JSON.parse(result.value) : null;
  }

  async getAllConfig() {
    const configs = await this.db.all('SELECT * FROM config');
    const result = {};
    for (const config of configs) {
      result[config.key] = JSON.parse(config.value);
    }
    return result;
  }

  // Session methods
  async startSession() {
    const result = await this.db.run(
      'INSERT INTO sessions (start_time) VALUES (CURRENT_TIMESTAMP)'
    );
    return result.lastID;
  }

  async endSession(sessionId) {
    await this.db.run(
      `UPDATE sessions 
       SET end_time = CURRENT_TIMESTAMP, 
           duration = (strftime('%s', CURRENT_TIMESTAMP) - strftime('%s', start_time))
       WHERE id = ?`,
      [sessionId]
    );
  }

  // Statistics methods
  async getStats() {
    const commandCount = await this.db.get('SELECT COUNT(*) as count FROM commands');
    const workflowCount = await this.db.get('SELECT COUNT(*) as count FROM workflows');
    const mostUsedCommand = await this.db.get(
      'SELECT name, usage_count FROM commands ORDER BY usage_count DESC LIMIT 1'
    );
    const mostExecutedWorkflow = await this.db.get(
      'SELECT name, execution_count FROM workflows ORDER BY execution_count DESC LIMIT 1'
    );
    
    return {
      totalCommands: commandCount.count,
      totalWorkflows: workflowCount.count,
      mostUsedCommand: mostUsedCommand,
      mostExecutedWorkflow: mostExecutedWorkflow
    };
  }

  async close() {
    if (this.db) {
      await this.db.close();
    }
  }
}

// Singleton instance
let dbInstance = null;

export async function getDatabase() {
  if (!dbInstance) {
    dbInstance = new Database();
    await dbInstance.init();
  }
  return dbInstance;
}