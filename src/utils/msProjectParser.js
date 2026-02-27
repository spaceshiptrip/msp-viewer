/**
 * Microsoft Project XML Parser
 * Handles the standard .xml export format from MS Project
 */

export function parseMsProjectXml(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid XML: ' + parseError.textContent);
  }

  // Extract project-level metadata
  const projectEl = doc.querySelector('Project');
  const projectName = getText(projectEl, 'Name') || getText(projectEl, 'Title') || 'Untitled Project';
  const projectStart = getText(projectEl, 'StartDate') || getText(projectEl, 'Start');
  const projectFinish = getText(projectEl, 'FinishDate') || getText(projectEl, 'Finish');
  const author = getText(projectEl, 'Author') || getText(projectEl, 'Manager') || '';
  const company = getText(projectEl, 'Company') || '';
  const lastSaved = getText(projectEl, 'LastSaved') || '';

  // Extract tasks
  const taskElements = Array.from(doc.querySelectorAll('Tasks > Task'));
  const rawTasks = taskElements.map(parseTask).filter(Boolean);

  // Build hierarchy
  const tasks = buildHierarchy(rawTasks);

  // Extract resources
  const resourceElements = Array.from(doc.querySelectorAll('Resources > Resource'));
  const resources = resourceElements.map(parseResource).filter(Boolean);

  // Build resource map
  const resourceMap = {};
  resources.forEach(r => { resourceMap[r.uid] = r; });

  // Extract assignments
  const assignmentElements = Array.from(doc.querySelectorAll('Assignments > Assignment'));
  const assignments = assignmentElements.map(a => ({
    uid: getText(a, 'UID'),
    taskUid: getText(a, 'TaskUID'),
    resourceUid: getText(a, 'ResourceUID'),
    units: parseFloat(getText(a, 'Units') || '1'),
  }));

  // Attach resource names to tasks
  const taskResourceMap = {};
  assignments.forEach(assign => {
    if (!taskResourceMap[assign.taskUid]) taskResourceMap[assign.taskUid] = [];
    const res = resourceMap[assign.resourceUid];
    if (res && res.name) taskResourceMap[assign.taskUid].push(res.name);
  });

  tasks.forEach(task => {
    task.resources = taskResourceMap[task.uid] || [];
  });

  // Compute overall date range
  const allDates = tasks
    .filter(t => t.start && t.finish)
    .flatMap(t => [new Date(t.start), new Date(t.finish)]);

  const minDate = allDates.length ? new Date(Math.min(...allDates)) : new Date();
  const maxDate = allDates.length ? new Date(Math.max(...allDates)) : new Date();

  return {
    projectName,
    projectStart: projectStart || minDate.toISOString(),
    projectFinish: projectFinish || maxDate.toISOString(),
    author,
    company,
    lastSaved,
    tasks,
    resources,
    assignments,
    minDate,
    maxDate,
  };
}

function parseTask(el) {
  const uid = getText(el, 'UID');
  if (uid === '0') return null; // Skip summary/root task with UID 0

  const name = getText(el, 'Name');
  if (!name) return null;

  const start = parseDate(getText(el, 'Start'));
  const finish = parseDate(getText(el, 'Finish'));
  const durationStr = getText(el, 'Duration');
  const duration = parseDuration(durationStr);
  const outlineLevel = parseInt(getText(el, 'OutlineLevel') || '1', 10);
  const isSummary = getText(el, 'Summary') === '1';
  const isMilestone = getText(el, 'Milestone') === '1';
  const percentComplete = parseInt(getText(el, 'PercentComplete') || '0', 10);
  const priority = parseInt(getText(el, 'Priority') || '500', 10);
  const notes = getText(el, 'Notes') || '';
  const wbs = getText(el, 'WBS') || '';
  const id = getText(el, 'ID') || uid;

  // Predecessors
  const predEls = Array.from(el.querySelectorAll('PredecessorLink'));
  const predecessors = predEls.map(p => getText(p, 'PredecessorUID')).filter(Boolean);

  return {
    uid,
    id,
    name,
    start,
    finish,
    duration,
    outlineLevel,
    isSummary,
    isMilestone,
    percentComplete,
    priority,
    notes,
    wbs,
    predecessors,
    resources: [],
    children: [],
  };
}

function parseResource(el) {
  const uid = getText(el, 'UID');
  if (uid === '0') return null;
  const name = getText(el, 'Name');
  if (!name) return null;
  return {
    uid,
    name,
    type: getText(el, 'Type'),
    initials: getText(el, 'Initials'),
    emailAddress: getText(el, 'EmailAddress'),
  };
}

function buildHierarchy(tasks) {
  // Just flatten but preserve outline levels - we'll use them for indentation
  // Also compute parent-child for collapsing
  const result = [];
  const stack = [];

  tasks.forEach(task => {
    // pop stack until we find parent level
    while (stack.length > 0 && stack[stack.length - 1].outlineLevel >= task.outlineLevel) {
      stack.pop();
    }
    task.parentUid = stack.length > 0 ? stack[stack.length - 1].uid : null;
    if (stack.length > 0) {
      stack[stack.length - 1].children.push(task.uid);
    }
    result.push(task);
    if (task.isSummary) {
      stack.push(task);
    }
  });

  return result;
}

function getText(el, tag) {
  if (!el) return '';
  const child = el.querySelector(':scope > ' + tag);
  return child ? child.textContent.trim() : '';
}

function parseDate(str) {
  if (!str) return null;
  // MS Project dates: "2024-01-15T08:00:00" or "2024-01-15T08:00:00Z"
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function parseDuration(str) {
  if (!str) return 0;
  // Duration in format PT8H or P1DT0H or PT40H etc (ISO 8601 duration)
  // Or just numeric hours
  const match = str.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (match) {
    const days = parseInt(match[1] || '0', 10);
    const hours = parseInt(match[2] || '0', 10);
    const mins = parseInt(match[3] || '0', 10);
    return days * 8 + hours + mins / 60; // work hours (8h day)
  }
  return parseFloat(str) || 0;
}
