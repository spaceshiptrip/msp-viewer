import React, { useMemo, useState, useRef, useCallback } from 'react';

const ROW_HEIGHT = 36;
const LABEL_WIDTH = 320;
const MIN_COL_WIDTH = 28;
const BAR_PADDING_V = 8;
const ARROW_COLOR = '#627d98';
const ARROW_HIGHLIGHT = '#38bdf8';

const GROUP_COLORS = [
  '#38bdf8', '#f472b6', '#34d399', '#a78bfa',
  '#fb923c', '#facc15', '#2dd4bf', '#60a5fa',
];

function getBarColor(task, groupIndex) {
  if (task.isMilestone) return '#fbbf24';
  if (task.isSummary) return '#1e3a52';
  return GROUP_COLORS[groupIndex % GROUP_COLORS.length];
}

export default function Timeline({ project, fileName, onReset }) {
  const [collapsed, setCollapsed] = useState(new Set());
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState('weeks');
  const [tooltip, setTooltip] = useState(null);
  const [search, setSearch] = useState('');
  const [showArrows, setShowArrows] = useState(true);
  const [highlightedTask, setHighlightedTask] = useState(null);
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'date'
  const [todayFocus, setTodayFocus] = useState(false); // highlight near-today tasks
  const [navIndex, setNavIndex] = useState(null); // index into chronoEvents for prev/next nav
  const scrollRef = useRef(null);
  const leftPanelRef = useRef(null);

  const { tasks, minDate, maxDate, projectName, author, company } = project;

  const endMs = new Date(maxDate).getTime();
  const totalDays = Math.max(1, Math.ceil((endMs - new Date(minDate).getTime()) / 86400000)) + 4;

  const colWidth = useMemo(() => {
    const base = view === 'days' ? 40 : view === 'weeks' ? 120 : 60;
    return Math.max(MIN_COL_WIDTH, base * zoom);
  }, [view, zoom]);

  const columns = useMemo(() => {
    const cols = [];
    const start = new Date(minDate);
    start.setHours(0, 0, 0, 0);

    if (view === 'days') {
      for (let d = 0; d <= totalDays; d++) {
        const dt = new Date(start.getTime() + d * 86400000);
        cols.push({ label: dt.getDate().toString(), date: dt, isMajor: dt.getDate() === 1, isWeekend: dt.getDay() === 0 || dt.getDay() === 6 });
      }
    } else if (view === 'weeks') {
      const weekStart = new Date(start);
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      let w = new Date(weekStart);
      while (w.getTime() <= endMs + 7 * 86400000) {
        cols.push({ label: `${w.getDate()} ${w.toLocaleString('default', { month: 'short' })}`, date: new Date(w), isMajor: w.getDate() <= 7 });
        w.setDate(w.getDate() + 7);
      }
    } else {
      let m = new Date(start.getFullYear(), start.getMonth(), 1);
      while (m.getTime() <= endMs + 32 * 86400000) {
        cols.push({ label: m.toLocaleString('default', { month: 'short' }), subLabel: m.getFullYear().toString(), date: new Date(m), isMajor: m.getMonth() === 0 });
        m.setMonth(m.getMonth() + 1);
      }
    }
    return cols;
  }, [minDate, maxDate, view, totalDays, endMs]);

  const totalWidth = columns.length * colWidth;

  const getX = useCallback((dateStr) => {
    if (!dateStr) return 0;
    const unit = view === 'days' ? 86400000 : view === 'weeks' ? 7 * 86400000 : 30.4375 * 86400000;
    return ((new Date(dateStr).getTime() - new Date(columns[0].date).getTime()) / unit) * colWidth;
  }, [columns, colWidth, view]);

  const getBarWidth = useCallback((start, finish) => {
    if (!start || !finish) return colWidth;
    const unit = view === 'days' ? 86400000 : view === 'weeks' ? 7 * 86400000 : 30.4375 * 86400000;
    return Math.max(4, ((new Date(finish).getTime() - new Date(start).getTime()) / unit) * colWidth);
  }, [colWidth, view]);

  // Group color index per top-level summary
  const groupIndexMap = useMemo(() => {
    const map = {};
    let gi = 0;
    tasks.forEach(t => { if (!t.parentUid) map[t.uid] = gi++; });
    const resolve = (uid, idx) => tasks.filter(t => t.parentUid === uid).forEach(child => { map[child.uid] = idx; resolve(child.uid, idx); });
    tasks.forEach(t => { if (!t.parentUid) resolve(t.uid, map[t.uid]); });
    return map;
  }, [tasks]);

  const taskByUid = useMemo(() => {
    const m = {}; tasks.forEach(t => { m[t.uid] = t; }); return m;
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    const hidden = new Set();
    const result = [];
    tasks.forEach(task => {
      if (hidden.has(task.uid)) return;
      if (search && !task.name.toLowerCase().includes(search.toLowerCase())) {
        if (!task.isSummary) return;
      }
      result.push(task);
      if (task.isSummary && collapsed.has(task.uid)) {
        const hide = (uid) => tasks.filter(t => t.parentUid === uid).forEach(child => { hidden.add(child.uid); hide(child.uid); });
        hide(task.uid);
      }
    });
    return result;
  }, [tasks, collapsed, search]);

  const sortedVisibleTasks = useMemo(() => {
    if (sortBy === 'date') {
      return [...visibleTasks].sort((a, b) => {
        const da = a.start ? new Date(a.start).getTime() : Infinity;
        const db = b.start ? new Date(b.start).getTime() : Infinity;
        return da - db;
      });
    }
    if (sortBy === 'original') {
      // Re-filter using the original XML task array order, ignoring hierarchy walk
      const hidden = new Set();
      if (collapsed.size > 0) {
        // Still respect collapse: hide children of collapsed summaries
        tasks.forEach(task => {
          if (task.isSummary && collapsed.has(task.uid)) {
            const hide = (uid) => tasks.filter(t => t.parentUid === uid).forEach(child => { hidden.add(child.uid); hide(child.uid); });
            hide(task.uid);
          }
        });
      }
      return tasks.filter(t => {
        if (hidden.has(t.uid)) return false;
        if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      });
    }
    // 'default': hierarchy order (visibleTasks already in WBS/outline order)
    return visibleTasks;
  }, [visibleTasks, sortBy, tasks, collapsed, search]);

  const uidToRow = useMemo(() => {
    const m = {}; sortedVisibleTasks.forEach((t, i) => { m[t.uid] = i; }); return m;
  }, [sortedVisibleTasks]);

  // Build SVG dependency arrows
  const arrows = useMemo(() => {
    if (!showArrows) return [];
    const result = [];
    const STEP = 8; // horizontal elbow offset

    sortedVisibleTasks.forEach(succ => {
      if (!succ.predecessors?.length) return;
      const succRow = uidToRow[succ.uid];
      if (succRow === undefined) return;

      succ.predecessors.forEach(predUid => {
        const pred = taskByUid[predUid];
        if (!pred?.finish || !succ.start) return;
        const predRow = uidToRow[predUid];
        if (predRow === undefined) return;

        const predEndX = getX(pred.finish);
        const succStartX = getX(succ.start);
        const predY = predRow * ROW_HEIGHT + ROW_HEIGHT / 2;
        const succY = succRow * ROW_HEIGHT + ROW_HEIGHT / 2;
        const isHighlighted = highlightedTask === succ.uid || highlightedTask === predUid;

        // Arrowhead is drawn via marker — we end the line 6px before target so the marker tip lands on target
        const ARROWHEAD_OFFSET = 6;

        let path;
        if (succStartX > predEndX + STEP) {
          // Simple L-shape: right → down → right
          const elbowX = predEndX + STEP;
          path = `M${predEndX},${predY} H${elbowX} V${succY} H${succStartX - ARROWHEAD_OFFSET}`;
        } else {
          // Need to route around: go right from pred end, drop/rise past row boundary, go left to succ
          const rightX = predEndX + STEP;
          const leftX = succStartX - STEP - ARROWHEAD_OFFSET;
          const detourY = succY > predY
            ? predY + ROW_HEIGHT * 0.6
            : predY - ROW_HEIGHT * 0.6;

          path = `M${predEndX},${predY} H${rightX} V${detourY} H${leftX} V${succY} H${succStartX - ARROWHEAD_OFFSET}`;
        }

        result.push({ path, isHighlighted });
      });
    });
    return result;
  }, [sortedVisibleTasks, uidToRow, taskByUid, getX, showArrows, highlightedTask]);

  const toggleCollapse = (uid) => {
    setCollapsed(prev => { const n = new Set(prev); n.has(uid) ? n.delete(uid) : n.add(uid); return n; });
  };

  const formatDate = (str) => {
    if (!str) return '–';
    return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const todayX = getX(new Date().toISOString());
  const totalRowsHeight = sortedVisibleTasks.length * ROW_HEIGHT;

  // Classify tasks relative to today
  const now = Date.now();
  const JUST_FINISHED_WINDOW = 14 * 86400000; // 14 days ago
  const UPCOMING_WINDOW = 21 * 86400000;       // 21 days ahead

  const nearTodayUids = useMemo(() => {
    const set = new Set();
    sortedVisibleTasks.forEach(t => {
      if (t.isSummary || t.isMilestone) return;
      const finish = t.finish ? new Date(t.finish).getTime() : null;
      const start = t.start ? new Date(t.start).getTime() : null;
      const justFinished = finish && finish >= now - JUST_FINISHED_WINDOW && finish <= now;
      const upcoming = start && start >= now && start <= now + UPCOMING_WINDOW;
      const inProgress = start && finish && start <= now && finish >= now;
      if (justFinished || upcoming || inProgress) set.add(t.uid);
    });
    return set;
  }, [sortedVisibleTasks, now]);

  // All navigable events sorted chronologically by their key date
  // Key date: finish for completed tasks, start for everything else
  const chronoEvents = useMemo(() => {
    return sortedVisibleTasks
      .filter(t => !t.isSummary && (t.start || t.finish))
      .map(t => {
        const finishMs = t.finish ? new Date(t.finish).getTime() : null;
        const startMs  = t.start  ? new Date(t.start).getTime()  : null;
        const isDone = finishMs && finishMs < now;
        const keyDate = isDone ? finishMs : (startMs || finishMs);
        return { uid: t.uid, keyDate };
      })
      .sort((a, b) => a.keyDate - b.keyDate);
  }, [sortedVisibleTasks, now]);

  // ── Scroll sync ──────────────────────────────────────────────────────────
  // Gantt is the master vertical scroller. Left panel mirrors it instantly.
  // Simple equality check prevents feedback loops without needing a mutex.
  const syncFromGantt = useCallback(() => {
    const g = scrollRef.current;
    const l = leftPanelRef.current;
    if (!g || !l) return;
    if (l.scrollTop !== g.scrollTop) l.scrollTop = g.scrollTop;
  }, []);

  const syncFromLeft = useCallback(() => {
    const g = scrollRef.current;
    const l = leftPanelRef.current;
    if (!g || !l) return;
    if (g.scrollTop !== l.scrollTop) g.scrollTop = l.scrollTop;
  }, []);

  // Scroll gantt to a position; left panel follows via syncFromGantt event.
  // For instant (non-smooth) programmatic scrolls we also set left directly.
  const scrollVerticalTo = useCallback((top) => {
    const g = scrollRef.current;
    const l = leftPanelRef.current;
    if (!g) return;
    g.scrollTop = top;          // instant — fires onScroll → syncFromGantt
    if (l) l.scrollTop = top;   // belt-and-suspenders
  }, []);

  // ── Navigation helpers ────────────────────────────────────────────────────
  const scrollToEvent = useCallback((uid) => {
    const task = sortedVisibleTasks.find(t => t.uid === uid);
    if (!task) return;
    setHighlightedTask(uid);
    setTodayFocus(false);

    // Vertical — instant so left panel stays in sync
    const row = uidToRow[uid];
    if (row !== undefined) {
      scrollVerticalTo(Math.max(0, row * ROW_HEIGHT - 120));
    }

    // Horizontal — smooth is fine, only the gantt scrolls horizontally
    const finishMs = task.finish ? new Date(task.finish).getTime() : null;
    const startMs  = task.start  ? new Date(task.start).getTime()  : null;
    const isDone   = finishMs && finishMs < now;
    const focusDate = isDone ? task.finish : (task.start || task.finish);
    if (focusDate && scrollRef.current) {
      const focusX    = getX(focusDate);
      const containerW = scrollRef.current.clientWidth;
      scrollRef.current.scrollTo({ left: Math.max(0, focusX - containerW / 2), behavior: 'smooth' });
    }
  }, [sortedVisibleTasks, uidToRow, getX, now, scrollVerticalTo]);

  const goToNext = useCallback(() => {
    if (chronoEvents.length === 0) return;
    const next = navIndex === null
      ? (() => { const i = chronoEvents.findIndex(e => e.keyDate >= now); return i === -1 ? chronoEvents.length - 1 : i; })()
      : Math.min(navIndex + 1, chronoEvents.length - 1);
    setNavIndex(next);
    scrollToEvent(chronoEvents[next].uid);
  }, [chronoEvents, navIndex, now, scrollToEvent]);

  const goToPrev = useCallback(() => {
    if (chronoEvents.length === 0) return;
    const prev = navIndex === null
      ? (() => { const i = [...chronoEvents].reverse().findIndex(e => e.keyDate < now); return i === -1 ? 0 : chronoEvents.length - 1 - i; })()
      : Math.max(navIndex - 1, 0);
    setNavIndex(prev);
    scrollToEvent(chronoEvents[prev].uid);
  }, [chronoEvents, navIndex, now, scrollToEvent]);

  const goToToday = useCallback(() => {
    setNavIndex(null);
    setHighlightedTask(null);
    setTodayFocus(true);

    // Horizontal
    if (scrollRef.current) {
      const containerW = scrollRef.current.clientWidth;
      scrollRef.current.scrollTo({ left: Math.max(0, todayX - containerW / 2), behavior: 'smooth' });
    }
    // Vertical — jump to first near-today task
    const firstRow = sortedVisibleTasks.findIndex(t => nearTodayUids.has(t.uid));
    if (firstRow !== -1) scrollVerticalTo(Math.max(0, firstRow * ROW_HEIGHT - 80));

    setTimeout(() => setTodayFocus(false), 3000);
  }, [todayX, sortedVisibleTasks, nearTodayUids, scrollVerticalTo]);

  const navEventUid = navIndex !== null && chronoEvents[navIndex] ? chronoEvents[navIndex].uid : null;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-steel-950">
      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-5 py-2.5 border-b border-steel-800 shrink-0 bg-steel-950">
        <div className="flex items-center gap-2 mr-3 shrink-0">
          <img src="/logo.png" alt="spaceshiptrip" className="w-7 h-7 object-contain" />
          <span className="font-mono text-xs text-steel-500 tracking-widest uppercase">MS Project</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-mono text-sm font-semibold text-steel-100 truncate">{projectName}</h1>
          <div className="flex gap-3 text-xs text-steel-600 font-mono">
            {author && <span>{author}</span>}
            {company && <span>· {company}</span>}
            <span>· {fileName}</span>
            <span>· {sortedVisibleTasks.length} tasks</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative shrink-0">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-steel-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter tasks..."
            className="bg-steel-900 border border-steel-700 rounded pl-6 pr-3 py-1.5 text-xs text-steel-300 placeholder-steel-600 focus:outline-none focus:border-sky-500 w-36" />
        </div>

        {/* Today + Prev/Next navigation group */}
        <div className="shrink-0 flex items-center rounded border border-steel-700 overflow-hidden">
          {/* Prev */}
          <button
            onClick={goToPrev}
            disabled={navIndex === 0}
            title="Previous activity"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono text-steel-400 hover:text-violet-300 hover:bg-violet-500/10 border-r border-steel-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Prev
          </button>

          {/* Today */}
          <button
            onClick={goToToday}
            title="Jump to today"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-rose-400 hover:bg-rose-500/10 border-r border-steel-700 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Today
            {navIndex !== null && (
              <span className="font-mono text-xs text-steel-500 ml-0.5">
                {navIndex + 1}/{chronoEvents.length}
              </span>
            )}
          </button>

          {/* Next */}
          <button
            onClick={goToNext}
            disabled={navIndex !== null && navIndex >= chronoEvents.length - 1}
            title="Next activity"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono text-steel-400 hover:text-violet-300 hover:bg-violet-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Sort toggle */}
        <div className="flex bg-steel-900 rounded border border-steel-700 overflow-hidden shrink-0">
          {[
            { key: 'default', label: 'Outline' },
            { key: 'original', label: 'XML' },
            { key: 'date',     label: 'Date' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setSortBy(key)}
              className={`px-2.5 py-1.5 text-xs font-mono transition-colors border-r border-steel-700 last:border-r-0 ${sortBy === key ? 'bg-emerald-600 text-white' : 'text-steel-400 hover:text-steel-200'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Links toggle */}
        <button onClick={() => setShowArrows(a => !a)}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-mono transition-colors ${showArrows ? 'border-sky-600 text-sky-400 bg-sky-500/10' : 'border-steel-700 text-steel-500'}`}>
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 10h12m0 0l-4-4m4 4l-4 4" />
          </svg>
          {showArrows ? 'Links On' : 'Links Off'}
        </button>

        {/* View */}
        <div className="flex bg-steel-900 rounded border border-steel-700 overflow-hidden shrink-0">
          {['days', 'weeks', 'months'].map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-2.5 py-1.5 text-xs font-mono transition-colors ${view === v ? 'bg-sky-500 text-white' : 'text-steel-400 hover:text-steel-200'}`}>
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => setZoom(z => Math.max(0.3, Math.round((z - 0.2) * 10) / 10))} className="w-6 h-6 rounded bg-steel-800 text-steel-300 hover:bg-steel-700 flex items-center justify-center text-base">−</button>
          <span className="font-mono text-xs text-steel-500 w-9 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(4, Math.round((z + 0.2) * 10) / 10))} className="w-6 h-6 rounded bg-steel-800 text-steel-300 hover:bg-steel-700 flex items-center justify-center text-base">+</button>
        </div>

        <button onClick={onReset} className="shrink-0 text-xs font-mono text-steel-500 hover:text-rose-400 transition-colors border border-steel-700 hover:border-rose-500/50 px-2.5 py-1.5 rounded">
          ✕ Close
        </button>
      </header>

      {/* ── Body ── */}
      {/* Nav event info banner */}
      {navIndex !== null && navEventUid && (() => {
        const navTask = sortedVisibleTasks.find(t => t.uid === navEventUid);
        if (!navTask) return null;
        const finishMs = navTask.finish ? new Date(navTask.finish).getTime() : null;
        const startMs  = navTask.start  ? new Date(navTask.start).getTime()  : null;
        const isDone = finishMs && finishMs < now;
        const isActive = startMs && finishMs && startMs <= now && finishMs >= now;
        const statusColor = isDone ? '#fbbf24' : isActive ? '#10b981' : '#a78bfa';
        const statusLabel = isDone ? 'Completed' : isActive ? 'In Progress' : 'Upcoming';
        const keyDate = isDone ? navTask.finish : (navTask.start || navTask.finish);
        return (
          <div className="shrink-0 flex items-center gap-3 px-5 py-1.5 border-b border-steel-800 bg-steel-900/60" style={{ borderLeft: `3px solid ${statusColor}` }}>
            <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: `${statusColor}20`, color: statusColor }}>{statusLabel}</span>
            <span className="font-mono text-xs text-steel-200 font-medium truncate">{navTask.name}</span>
            {navTask.isMilestone && <span className="text-amber-400 text-xs shrink-0">◆ Milestone</span>}
            <span className="font-mono text-xs text-steel-500 shrink-0">{isDone ? 'Finished' : 'Due'}: {formatDate(keyDate)}</span>
            {navTask.resources?.length > 0 && <span className="font-mono text-xs text-steel-600 shrink-0">{navTask.resources.join(', ')}</span>}
            <span className="font-mono text-xs text-steel-600 ml-auto shrink-0">{navIndex + 1} / {chronoEvents.length}</span>
          </div>
        );
      })()}

      <div className="flex flex-1 overflow-hidden">

        {/* Left task list */}
        <div className="shrink-0 border-r border-steel-800 flex flex-col overflow-hidden" style={{ width: LABEL_WIDTH }}>
          <div className="shrink-0 bg-steel-900 border-b border-steel-700 flex items-end px-4 pb-2" style={{ height: 56 }}>
            <span className="font-mono text-xs text-steel-500 uppercase tracking-widest">Task Name</span>
            <span className="ml-auto font-mono text-xs text-steel-600">%</span>
          </div>
          <div
            ref={leftPanelRef}
            className="overflow-y-auto overflow-x-hidden flex-1"
            style={{ scrollbarWidth: 'none' }}
            onScroll={syncFromLeft}
          >
            {sortedVisibleTasks.map((task, idx) => {
              const indent = sortBy === 'default' ? (task.outlineLevel - 1) * 14 : 8;
              const barColor = getBarColor(task, groupIndexMap[task.uid] ?? 0);
              const isHighlighted = highlightedTask === task.uid;
              const isNearToday = todayFocus && nearTodayUids.has(task.uid);
              const isNavFocused = task.uid === navEventUid;

              // classify for label
              const finish = task.finish ? new Date(task.finish).getTime() : null;
              const start = task.start ? new Date(task.start).getTime() : null;
              const justFinished = finish && finish >= now - JUST_FINISHED_WINDOW && finish <= now;
              const inProgress = start && finish && start <= now && finish >= now;

              return (
                <div key={task.uid}
                  className={`task-row flex items-center border-b border-steel-900 cursor-pointer select-none transition-colors duration-300 ${isNavFocused ? 'bg-violet-500/20 border-l-2 border-l-violet-400' : isHighlighted ? 'bg-sky-500/10' : isNearToday ? (inProgress ? 'bg-emerald-500/10' : justFinished ? 'bg-amber-500/10' : 'bg-violet-500/10') : ''}`}
                  style={{ height: ROW_HEIGHT, paddingLeft: 8 + indent }}
                  onClick={() => setHighlightedTask(h => h === task.uid ? null : task.uid)}
                >
                  {task.isSummary ? (
                    <button onClick={e => { e.stopPropagation(); toggleCollapse(task.uid); }}
                      className="w-4 h-4 flex items-center justify-center text-steel-500 hover:text-steel-200 shrink-0 mr-1 text-xs">
                      {collapsed.has(task.uid) ? '▶' : '▼'}
                    </button>
                  ) : (
                    <span className="w-5 shrink-0 mr-1 flex items-center justify-center">
                      {task.isMilestone
                        ? <span className="text-amber-400 text-xs">◆</span>
                        : <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: barColor }} />}
                    </span>
                  )}
                  <span className={`text-xs truncate flex-1 ${task.isSummary ? 'font-semibold text-steel-200' : 'text-steel-300'} ${task.isMilestone ? 'text-amber-400' : ''}`} title={task.name}>
                    {task.name}
                  </span>
                  {isNearToday && !task.isSummary && (
                    <span className={`font-mono text-xs px-1.5 py-0.5 rounded shrink-0 ml-1 ${inProgress ? 'bg-emerald-500/20 text-emerald-400' : justFinished ? 'bg-amber-500/20 text-amber-400' : 'bg-violet-500/20 text-violet-400'}`}>
                      {inProgress ? '▶' : justFinished ? '✓' : '↑'}
                    </span>
                  )}
                  {isNavFocused && (
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded shrink-0 ml-1 bg-violet-500/30 text-violet-300 animate-pulse">→</span>
                  )}
                  {task.percentComplete > 0 && (
                    <span className="font-mono text-xs text-steel-600 ml-2 mr-3 shrink-0">{task.percentComplete}%</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Gantt */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto"
          onScroll={syncFromGantt}
        >
          <div style={{ width: Math.max(totalWidth + 60, 600), minHeight: '100%' }}>

            {/* Column headers */}
            <div className="sticky top-0 z-20 bg-steel-900 border-b border-steel-700" style={{ height: 56 }}>
              {view === 'weeks' && (
                <div className="absolute top-0 left-0 right-0 h-6 border-b border-steel-800 overflow-hidden">
                  {(() => {
                    const groups = [];
                    let cur = null;
                    columns.forEach((col, i) => {
                      const key = col.date.toLocaleString('default', { month: 'long', year: 'numeric' });
                      if (key !== cur?.key) { cur = { key, x: i * colWidth, count: 1 }; groups.push(cur); } else cur.count++;
                    });
                    return groups.map(g => (
                      <div key={g.key} className="absolute font-mono text-xs text-steel-500 px-2 flex items-center h-full border-r border-steel-800 overflow-hidden whitespace-nowrap" style={{ left: g.x, width: g.count * colWidth }}>
                        {g.key}
                      </div>
                    ));
                  })()}
                </div>
              )}
              <div className="absolute left-0 right-0 overflow-hidden flex" style={{ top: view === 'weeks' ? 24 : 0, bottom: 0 }}>
                {columns.map((col, i) => (
                  <div key={i}
                    className={`shrink-0 border-r flex flex-col items-center justify-end pb-1.5 ${col.isMajor ? 'border-steel-600' : 'border-steel-800'} ${col.isWeekend ? 'bg-steel-900/60' : ''}`}
                    style={{ width: colWidth }}>
                    <span className={`font-mono text-xs select-none ${col.isMajor ? 'text-steel-300 font-semibold' : 'text-steel-600'}`}>{col.label}</span>
                    {col.subLabel && <span className="font-mono text-xs text-steel-500 select-none">{col.subLabel}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Gantt body */}
            <div className="relative" style={{ height: totalRowsHeight + 40 }}>

              {/* Grid */}
              <div className="absolute inset-0 pointer-events-none">
                {columns.map((col, i) => (
                  <div key={i}
                    className={`absolute top-0 bottom-0 border-r ${col.isMajor ? 'border-steel-700/50' : 'border-steel-800/30'} ${col.isWeekend ? 'bg-steel-900/25' : ''}`}
                    style={{ left: i * colWidth, width: colWidth }} />
                ))}
                {sortedVisibleTasks.map((_, i) => i % 2 === 0 ? (
                  <div key={i} className="absolute left-0 right-0 bg-white/[0.015]" style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }} />
                ) : null)}
              </div>

              {/* Watermark */}
              <div className="absolute bottom-6 right-6 pointer-events-none select-none flex items-center gap-2 opacity-[0.04] z-10">
                <img src="/logo.png" alt="" className="w-10 h-10 object-contain" />
                <span className="font-mono text-2xl font-bold text-white tracking-widest">spaceshiptrip</span>
              </div>

              {/* Today line */}
              {todayX > 0 && todayX < totalWidth && (
                <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: todayX }}>
                  <div className="absolute top-0 bottom-0 w-px bg-rose-500/60" />
                  <div className="absolute top-0 left-1 font-mono text-xs text-rose-400 bg-steel-950/80 px-1 rounded-b">today</div>
                </div>
              )}

              {/* ── Dependency arrows SVG ── */}
              <svg
                className="absolute top-0 left-0 pointer-events-none overflow-visible z-10"
                style={{ width: totalWidth + 60, height: totalRowsHeight + 40 }}
              >
                <defs>
                  <marker id="arrowN" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                    <path d="M0,1 L6,3.5 L0,6" fill="none" stroke={ARROW_COLOR} strokeWidth="1.2" />
                  </marker>
                  <marker id="arrowH" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                    <path d="M0,1 L6,3.5 L0,6" fill="none" stroke={ARROW_HIGHLIGHT} strokeWidth="1.5" />
                  </marker>
                </defs>
                {arrows.map((a, i) => (
                  <path
                    key={i}
                    d={a.path}
                    fill="none"
                    stroke={a.isHighlighted ? ARROW_HIGHLIGHT : ARROW_COLOR}
                    strokeWidth={a.isHighlighted ? 1.8 : 1.1}
                    opacity={a.isHighlighted ? 1 : 0.6}
                    markerEnd={a.isHighlighted ? 'url(#arrowH)' : 'url(#arrowN)'}
                  />
                ))}
              </svg>

              {/* Task bars */}
              {sortedVisibleTasks.map((task, idx) => {
                const groupIdx = groupIndexMap[task.uid] ?? 0;
                const barColor = getBarColor(task, groupIdx);
                const x = getX(task.start);
                const w = getBarWidth(task.start, task.finish);
                const barTop = task.isSummary ? ROW_HEIGHT * 0.33 : BAR_PADDING_V;
                const barH = task.isSummary ? ROW_HEIGHT * 0.28 : ROW_HEIGHT - BAR_PADDING_V * 2;
                const isHighlighted = highlightedTask === task.uid;
                const isNearToday = todayFocus && nearTodayUids.has(task.uid);
                const isNavFocused = task.uid === navEventUid;

                const finish = task.finish ? new Date(task.finish).getTime() : null;
                const start = task.start ? new Date(task.start).getTime() : null;
                const justFinished = finish && finish >= now - JUST_FINISHED_WINDOW && finish <= now;
                const inProgress = start && finish && start <= now && finish >= now;
                const todayGlowColor = inProgress ? '#10b981' : justFinished ? '#fbbf24' : '#a78bfa';

                return (
                  <div key={task.uid} className="absolute" style={{ top: idx * ROW_HEIGHT, height: ROW_HEIGHT, left: 0, right: 0 }}>
                    {/* Near-today row stripe */}
                    {isNearToday && (
                      <div className="absolute inset-0 pointer-events-none transition-opacity duration-500"
                        style={{ background: `${todayGlowColor}12`, borderLeft: `2px solid ${todayGlowColor}60` }} />
                    )}
                    {/* Nav-focused row stripe */}
                    {isNavFocused && (
                      <div className="absolute inset-0 pointer-events-none"
                        style={{ background: 'rgba(167,139,250,0.12)', borderLeft: '3px solid #a78bfa', boxShadow: 'inset 0 0 20px rgba(167,139,250,0.06)' }} />
                    )}
                    {task.start && (
                      task.isMilestone ? (
                        <div
                          className="absolute cursor-pointer"
                          style={{ left: x - 7, top: ROW_HEIGHT / 2 - 7, width: 14, height: 14, background: '#fbbf24', transform: 'rotate(45deg)', boxShadow: isNavFocused ? '0 0 18px #a78bfa, 0 0 8px #fbbf24' : isNearToday ? `0 0 14px ${todayGlowColor}` : '0 0 8px #fbbf2460', zIndex: 15 }}
                          onMouseEnter={e => setTooltip({ task, x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setTooltip(null)}
                          onClick={() => setHighlightedTask(h => h === task.uid ? null : task.uid)}
                        />
                      ) : (
                        task.finish && (
                          <div
                            className="absolute cursor-pointer gantt-bar"
                            style={{ left: x, width: w, top: barTop, height: barH, borderRadius: task.isSummary ? 3 : 5, zIndex: 15 }}
                            onMouseEnter={e => setTooltip({ task, x: e.clientX, y: e.clientY })}
                            onMouseLeave={() => setTooltip(null)}
                            onClick={() => setHighlightedTask(h => h === task.uid ? null : task.uid)}
                          >
                            {/* Track */}
                            <div className="absolute inset-0 rounded" style={{ background: barColor, opacity: task.isSummary ? 0.1 : 0.18 }} />
                            {/* Progress */}
                            {task.percentComplete > 0 && (
                              <div className="absolute top-0 bottom-0 left-0 rounded" style={{ background: barColor, width: `${task.percentComplete}%`, opacity: task.isSummary ? 0.5 : 0.85 }} />
                            )}
                            {/* Border */}
                            <div className="absolute inset-0 rounded" style={{ border: `${task.isSummary ? 1.5 : 1.5}px solid ${barColor}`, opacity: isHighlighted ? 1 : task.isSummary ? 0.5 : 0.7 }} />
                            {/* Glow when highlighted */}
                            {isHighlighted && <div className="absolute inset-0 rounded" style={{ boxShadow: `0 0 10px ${barColor}90` }} />}
                            {/* Near-today glow */}
                            {isNearToday && !isHighlighted && <div className="absolute inset-0 rounded" style={{ boxShadow: `0 0 12px ${todayGlowColor}80`, border: `1.5px solid ${todayGlowColor}80` }} />}
                            {/* Nav-focused glow */}
                            {isNavFocused && <div className="absolute inset-0 rounded" style={{ boxShadow: '0 0 16px #a78bfaaa, 0 0 4px #a78bfa', border: '2px solid #a78bfa' }} />}
                            {/* Resource label outside the bar */}
                            {task.resources?.length > 0 && w > 20 && (
                              <span className="absolute whitespace-nowrap pointer-events-none select-none font-mono"
                                style={{ left: w + 5, top: '50%', transform: 'translateY(-50%)', color: barColor, opacity: 0.8, fontSize: 10 }}>
                                {task.resources.join(', ')}
                              </span>
                            )}
                          </div>
                        )
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Footer stats */}
      <div className="shrink-0 border-t border-steel-800 bg-steel-950 px-6 py-2 flex items-center gap-6 flex-wrap">
        <StatPill label="Tasks" value={tasks.filter(t => !t.isSummary && !t.isMilestone).length} color="#38bdf8" />
        <StatPill label="Milestones" value={tasks.filter(t => t.isMilestone).length} color="#fbbf24" />
        <StatPill label="Summary" value={tasks.filter(t => t.isSummary).length} color="#486581" />
        <StatPill label="Complete" value={tasks.filter(t => t.percentComplete === 100).length} color="#34d399" />
        <StatPill label="Links" value={arrows.length} color={ARROW_COLOR} />
        {project.resources?.length > 0 && <StatPill label="Resources" value={project.resources.length} color="#a78bfa" />}
        {todayFocus && nearTodayUids.size > 0 && (
          <div className="flex items-center gap-3 ml-2 pl-4 border-l border-steel-800">
            <span className="font-mono text-xs text-steel-500">Near today:</span>
            <span className="flex items-center gap-1 font-mono text-xs text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/>In progress</span>
            <span className="flex items-center gap-1 font-mono text-xs text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>Just finished</span>
            <span className="flex items-center gap-1 font-mono text-xs text-violet-400"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block"/>Upcoming</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-4">
          <span className="font-mono text-xs text-steel-600">
            {formatDate(project.projectStart)} → {formatDate(project.projectFinish)}
          </span>
          <div className="flex items-center gap-2 pl-4 border-l border-steel-800">
            <img src="/logo.png" alt="spaceshiptrip" className="w-5 h-5 object-contain opacity-50" />
            <a
              href="https://github.com/spaceshiptrip/msp-viewer"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-steel-600 hover:text-sky-400 transition-colors flex items-center gap-1"
              title="github.com/spaceshiptrip/msp-viewer"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              spaceshiptrip
            </a>
          </div>
        </div>
      </div>

      {tooltip && <TaskTooltip task={tooltip.task} x={tooltip.x} y={tooltip.y} formatDate={formatDate} />}
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="font-mono text-xs text-steel-500">{label}</span>
      <span className="font-mono text-xs font-semibold text-steel-300">{value}</span>
    </div>
  );
}

function TaskTooltip({ task, x, y, formatDate }) {
  const safeX = Math.min(x + 16, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 290);
  return (
    <div className="fixed z-50 pointer-events-none bg-steel-900 border border-steel-700 rounded-lg shadow-2xl p-3 max-w-xs"
      style={{ left: safeX, top: y - 10 }}>
      <div className="font-semibold text-steel-100 text-sm mb-2">{task.name}</div>
      <div className="space-y-1 font-mono text-xs text-steel-400">
        {task.wbs && <div><span className="text-steel-600">WBS: </span>{task.wbs}</div>}
        <div><span className="text-steel-600">Start: </span>{formatDate(task.start)}</div>
        <div><span className="text-steel-600">Finish: </span>{formatDate(task.finish)}</div>
        {task.duration > 0 && <div><span className="text-steel-600">Duration: </span>{task.duration.toFixed(1)}h</div>}
        <div>
          <span className="text-steel-600">Progress: </span>
          <span className={task.percentComplete === 100 ? 'text-emerald-400' : 'text-steel-300'}>{task.percentComplete}%</span>
        </div>
        {task.resources?.length > 0 && <div><span className="text-steel-600">Assigned: </span>{task.resources.join(', ')}</div>}
        {task.predecessors?.length > 0 && <div><span className="text-steel-600">Predecessors: </span>UIDs {task.predecessors.join(', ')}</div>}
        {task.isMilestone && <div className="text-amber-400 mt-1">◆ Milestone</div>}
        {task.isSummary && <div className="text-sky-400 mt-1">▼ Summary Task</div>}
      </div>
    </div>
  );
}
