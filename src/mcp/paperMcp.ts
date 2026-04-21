/**
 * Paper MCP — demo integration surface.
 *
 * The product UI shows tool-style steps in the design sub-process transcript.
 * A real connector would swap this module for stdio/HTTP transport to a Paper MCP server;
 * the demo imports these identifiers so the wiring point stays visible in the codebase.
 */
export const PAPER_MCP_SERVER_LABEL = 'Paper MCP'

/** Canonical frame id used in the #frontend demo thread. */
export const PAPER_FRAME_SETTINGS_DEFERRED = 'settings-deferred-shell'

export const paperMcpTools = {
  listFrames: 'paper.list_frames',
  getFrame: 'paper.get_frame',
  fetchComments: 'paper.fetch_comments',
} as const
