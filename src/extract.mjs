// extract.mjs — parse .jsonl session files into structured session data
import { createReadStream } from 'fs';
import { readdir, stat } from 'fs/promises';
import { createInterface } from 'readline';
import { join, basename } from 'path';

export async function parseSession(filePath) {
  const fileStats = await stat(filePath);
  const session = {
    id:               basename(filePath, '.jsonl').substring(0, 8),
    slug:             null,
    gitBranch:        null,
    startTime:        null,
    endTime:          null,
    fileSizeBytes:    fileStats.size,
    userMessages:     0,
    assistantMessages:0,
    compacts:         0,
    compactPositions: [],
    turnDurations:    [],
    toolCalls:        {},
    filesEdited:      {},
    apiErrors:        0,
    totalRecords:     0,
    linesWritten:     0,
  };

  return new Promise((resolve) => {
    const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
    let recordCount = 0;

    rl.on('line', (line) => {
      if (!line.trim()) return;
      recordCount++;
      try {
        const obj = JSON.parse(line);

        if (obj.timestamp) {
          if (!session.startTime || obj.timestamp < session.startTime) session.startTime = obj.timestamp;
          if (!session.endTime   || obj.timestamp > session.endTime)   session.endTime   = obj.timestamp;
        }
        if (obj.slug      && !session.slug)      session.slug      = obj.slug;
        if (obj.gitBranch && !session.gitBranch) session.gitBranch = obj.gitBranch;

        if (obj.type === 'user'      && obj.message?.role === 'user')      session.userMessages++;
        if (obj.type === 'assistant' && obj.message?.role === 'assistant') session.assistantMessages++;

        if (obj.type === 'system') {
          if (obj.subtype === 'compact_boundary') {
            session.compacts++;
            session.compactPositions.push(recordCount);
          }
          if (obj.subtype === 'turn_duration' && obj.durationMs) {
            session.turnDurations.push(obj.durationMs);
          }
          if (obj.subtype === 'api_error') session.apiErrors++;
        }

        if (obj.type === 'assistant' && Array.isArray(obj.message?.content)) {
          for (const block of obj.message.content) {
            if (block.type !== 'tool_use') continue;
            const name = block.name;
            session.toolCalls[name] = (session.toolCalls[name] || 0) + 1;

            if ((name === 'Edit' || name === 'Write') && block.input?.file_path) {
              const f = block.input.file_path.replace(/^.*[/\\]/, '');
              session.filesEdited[f] = (session.filesEdited[f] || 0) + 1;
              const text = name === 'Edit' ? (block.input.new_string || '') : (block.input.content || '');
              session.linesWritten += (text.match(/\n/g) || []).length + (text.length > 0 ? 1 : 0);
            }
          }
        }
      } catch (_) {}
    });

    rl.on('close', () => {
      session.totalRecords     = recordCount;
      session.compactPositions = session.compactPositions.map(p =>
        recordCount > 0 ? p / recordCount : 0
      );
      resolve(session);
    });
  });
}

export async function loadProject(projectDir) {
  const files = (await readdir(projectDir))
    .filter(f => f.endsWith('.jsonl'))
    .map(f => join(projectDir, f));

  if (files.length === 0) throw new Error(`No .jsonl files found in ${projectDir}`);

  const sessions = [];
  for (const f of files) {
    sessions.push(await parseSession(f));
  }
  sessions.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  return sessions;
}
