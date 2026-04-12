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
const KnowledgeSearchInboxInputSchema = z.object({
  workspace: z.string(),
  query: z.string(),
  limit: z.number().int().positive().optional(),
});
const KnowledgeGetNextInboxFileInputSchema = z.object({
  workspace: z.string(),
});
const KnowledgeGetDedupeContextInputSchema = z.object({
  workspace: z.string(),
  file: z.string().describe('Inbox file path relative to workspace root'),
  query: z.string().describe('2-3 key terms extracted from the file content'),
});
const KnowledgeCompileNewInputSchema = z.object({
  workspace: z.string(),
  inbox_file: z.string().describe('Inbox file path to archive after compile'),
  article_path: z.string().describe('Target path relative to knowledge/ e.g. "concepts/my-article.md"'),
  content: z.string().describe('Full compiled article markdown including YAML frontmatter'),
});
const KnowledgeCompileExtendInputSchema = z.object({
  workspace: z.string(),
  inbox_file: z.string().describe('Inbox file path to archive after extend'),
  target_path: z.string().describe('Existing article path relative to workspace root e.g. "knowledge/concepts/existing.md"'),
  content: z.string().describe('Full updated article markdown including YAML frontmatter'),
});
const KnowledgeListInboxInputSchema = z.object({
  workspace: z.string(),
});
const KnowledgeWriteInputSchema = z.object({
  workspace: z.string(),
  path: z.string(),
  content: z.string(),
});
const KnowledgeArchiveInputSchema = z.object({
  workspace: z.string(),
  file: z.string(),
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
export const KnowledgeSearchInboxSchema = KnowledgeSearchInboxInputSchema.shape;
export const KnowledgeGetNextInboxFileSchema = KnowledgeGetNextInboxFileInputSchema.shape;
export const KnowledgeGetDedupeContextSchema = KnowledgeGetDedupeContextInputSchema.shape;
export const KnowledgeCompileNewSchema = KnowledgeCompileNewInputSchema.shape;
export const KnowledgeCompileExtendSchema = KnowledgeCompileExtendInputSchema.shape;
export const KnowledgeListInboxSchema = KnowledgeListInboxInputSchema.shape;
export const KnowledgeWriteSchema = KnowledgeWriteInputSchema.shape;
export const KnowledgeArchiveSchema = KnowledgeArchiveInputSchema.shape;
export const KnowledgeReadSchema = KnowledgeReadInputSchema.shape;
export const KnowledgeListSchema = KnowledgeListInputSchema.shape;

export const ToolSchemas = {
  knowledge_list_workspaces: KnowledgeListWorkspacesSchema,
  knowledge_workspace_status: KnowledgeWorkspaceStatusSchema,
  knowledge_ingest_text: KnowledgeIngestTextSchema,
  knowledge_ingest_clipboard: KnowledgeIngestClipboardSchema,
  knowledge_ingest_url: KnowledgeIngestUrlSchema,
  knowledge_search: KnowledgeSearchSchema,
  knowledge_search_inbox: KnowledgeSearchInboxSchema,
  knowledge_get_next_inbox_file: KnowledgeGetNextInboxFileSchema,
  knowledge_get_dedupe_context: KnowledgeGetDedupeContextSchema,
  knowledge_compile_new: KnowledgeCompileNewSchema,
  knowledge_compile_extend: KnowledgeCompileExtendSchema,
  knowledge_list_inbox: KnowledgeListInboxSchema,
  knowledge_write: KnowledgeWriteSchema,
  knowledge_archive: KnowledgeArchiveSchema,
  knowledge_read: KnowledgeReadSchema,
  knowledge_list: KnowledgeListSchema,
} as const;
