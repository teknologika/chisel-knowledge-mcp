import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { z } from 'zod';
import { logger } from '../logging/index.js';
import type { ConfigFile, WorkspaceConfig } from '../../domains/workspace/workspace.types.js';

const WorkspaceConfigSchema = z.object({
  name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Workspace name must be kebab-case'),
  path: z.string().refine((value) => isAbsolute(value), 'Workspace path must be absolute'),
});

const ConfigSchema = z
  .object({
    workspaces: z.array(WorkspaceConfigSchema).default([]),
  })
  .superRefine((config, context) => {
    const seen = new Set<string>();

    for (const workspace of config.workspaces) {
      if (seen.has(workspace.name)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate workspace name: ${workspace.name}`,
          path: ['workspaces'],
        });
      }

      seen.add(workspace.name);
    }
  });

export function defaultConfigPath(): string {
  return join(homedir(), '.chisel', 'config.json');
}

export function loadConfig(configPath: string = defaultConfigPath()): ConfigFile {
  if (!existsSync(configPath)) {
    logger.warn({ configPath }, 'Config file not found; starting with zero workspaces');
    return { workspaces: [] };
  }

  const raw = readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  const result = ConfigSchema.parse(parsed);

  return {
    workspaces: result.workspaces as WorkspaceConfig[],
  };
}
