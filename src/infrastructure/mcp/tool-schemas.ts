import { z } from 'zod';

const KnowledgeListWorkspacesInputSchema = z.object({});
const KnowledgeWorkspaceStatusInputSchema = z.object({
  workspace: z.string(),
});
const KnowledgeIngestTextInputSchema = z.object({
  workspace: z.string(),
  content: z.string(),
  title: z.string().optional(),
});
const KnowledgeIngestClipboardInputSchema = z.object({
  workspace: z.string(),
  title: z.string().optional(),
});
const KnowledgeIngestUrlInputSchema = z.object({
  workspace: z.string(),
  url: z.string(),
  title: z.string().optional(),
});
const KnowledgeSearchInputSchema = z.object({
  workspace: z.string(),
  query: z.string(),
  limit: z.number().int().positive().optional(),
});
const KnowledgeReadInputSchema = z.object({
  workspace: z.string(),
  path: z.string(),
});
const KnowledgeListInputSchema = z.object({
  workspace: z.string(),
  directory: z.string().optional(),
});

export const KnowledgeListWorkspacesSchema = KnowledgeListWorkspacesInputSchema.shape;
export const KnowledgeWorkspaceStatusSchema = KnowledgeWorkspaceStatusInputSchema.shape;
export const KnowledgeIngestTextSchema = KnowledgeIngestTextInputSchema.shape;
export const KnowledgeIngestClipboardSchema = KnowledgeIngestClipboardInputSchema.shape;
export const KnowledgeIngestUrlSchema = KnowledgeIngestUrlInputSchema.shape;
export const KnowledgeSearchSchema = KnowledgeSearchInputSchema.shape;
export const KnowledgeReadSchema = KnowledgeReadInputSchema.shape;
export const KnowledgeListSchema = KnowledgeListInputSchema.shape;

export const ToolSchemas = {
  knowledge_list_workspaces: KnowledgeListWorkspacesSchema,
  knowledge_workspace_status: KnowledgeWorkspaceStatusSchema,
  knowledge_ingest_text: KnowledgeIngestTextSchema,
  knowledge_ingest_clipboard: KnowledgeIngestClipboardSchema,
  knowledge_ingest_url: KnowledgeIngestUrlSchema,
  knowledge_search: KnowledgeSearchSchema,
  knowledge_read: KnowledgeReadSchema,
  knowledge_list: KnowledgeListSchema,
} as const;
