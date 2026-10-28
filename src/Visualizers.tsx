import { useState } from 'react';
import { ArrowRight, Check, ChevronRight, RotateCcw, Zap } from 'lucide-react';

// ─── Buddy System ───────────────────────────────────────────────────────────

type BuddyBlock = { id: number; start: number; size: number; state: 'free' | 'allocated'; request?: number };
const BUDDY_TOTAL = 64;

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function buddyOf(start: number, size: number): number {
  return start ^ size;
}

function initialBlocks(): BuddyBlock[] {
  return [{ id: 0, start: 0, size: BUDDY_TOTAL, state: 'free' }];
}

function allocate(blocks: BuddyBlock[], request: number): BuddyBlock[] {
  const needed = nextPow2(request);
  let next = [...blocks];
  let target = next.find((b) => b.state === 'free' && b.size >= needed && b.size === needed);
  if (!target) {
    // split the smallest free block large enough
    const toSplit = next.filter((b) => b.state === 'free' && b.size > needed).sort((a, b) => a.size - b.size)[0];
    if (!toSplit) return blocks;
    let current = toSplit;
    while (current.size > needed) {
      const half = current.size / 2;
      const idA = Date.now() + Math.random();
      const idB = idA + 1;
      next = next.filter((b) => b.id !== current.id);
      next.push({ id: idA, start: current.start, size: half, state: 'free' });
      next.push({ id: idB, start: current.start + half, size: half, state: 'free' });
      current = { id: idA, start: current.start, size: half, state: 'free' };
    }
    target = next.find((b) => b.state === 'free' && b.size === needed && b.start === current.start);
  }
  if (!target) return blocks;
  return next.map((b) => b.id === target!.id ? { ...b, state: 'allocated', request } : b);
}

function release(blocks: BuddyBlock[], id: number): BuddyBlock[] {
  let next = blocks.map((b) => b.id === id ? { ...b, state: 'free' as const, request: undefined } : b);
  let merged = true;
  while (merged) {
    merged = false;
    const freeBlocks = next.filter((b) => b.state === 'free');
    for (const block of freeBlocks) {
      const buddyStart = buddyOf(block.start, block.size);
      const buddy = next.find((b) => b.state === 'free' && b.start === buddyStart && b.size === block.size);
      if (buddy) {
        const mergedStart = Math.min(block.start, buddy.start);
        const mergedBlock: BuddyBlock = { id: Date.now() + Math.random(), start: mergedStart, size: block.size * 2, state: 'free' };
        next = next.filter((b) => b.id !== block.id && b.id !== buddy.id);
        next.push(mergedBlock);
        merged = true;
        break;
      }
    }
  }
  return next;
}

export function BuddyVisualizer() {
  const [blocks, setBlocks] = useState<BuddyBlock[]>(initialBlocks);
  const [request, setRequest] = useState(6);
  const [log, setLog] = useState<string[]>([]);
  const sorted = [...blocks].sort((a, b) => a.start - b.start);

  const doAllocate = () => {
    const next = allocate(blocks, request);
    if (next === blocks) { setLog((items) => [`No block available for size ${request}`, ...items].slice(0, 5)); return; }
    const allocated = next.find((b) => b.state === 'allocated' && b.request === request && !blocks.some((o) => o.id === b.id));
    const fragmentation = allocated ? allocated.size - request : 0;
    setBlocks(next);
    setLog((items) => [`Allocated ${request} units → block of ${allocated?.size ?? '?'} units (internal fragmentation: ${fragmentation})`, ...items].slice(0, 5));
  };

  const doRelease = (id: number, size: number) => {
    setBlocks(release(blocks, id));
    setLog((items) => [`Released ${size}-unit block → buddies merged if both free`, ...items].slice(0, 5));
  };

  const reset = () => { setBlocks(initialBlocks()); setLog([]); };

  return (
    <div className="vis-root">
      <div className="vis-header">
        <span className="vis-title"><Zap size={15} /> Buddy System — {BUDDY_TOTAL} units of memory</span>
        <button className="vis-btn outline" onClick={reset}><RotateCcw size={13} /> Reset</button>
      </div>
      <div className="buddy-bar">
        {sorted.map((block) => (
          <div key={block.id} className={`buddy-block ${block.state}`} style={{ flex: block.size }}>
            <span className="buddy-label">{block.state === 'allocated' ? `A:${block.request}→${block.size}` : `${block.size} free`}</span>
            {block.state === 'allocated' && <button className="buddy-free" onClick={() => doRelease(block.id, block.size)}>free</button>}
          </div>
        ))}
      </div>
      <div className="vis-controls">
        <label>Request size (units)
          <input type="number" min={1} max={32} value={request} onChange={(e) => setRequest(Math.max(1, Math.min(32, Number(e.target.value))))} />
        </label>
        <button className="vis-btn primary" onClick={doAllocate}>Allocate {request} units</button>
      </div>
      <div className="vis-legend"><span className="leg allocated" />Allocated<span className="leg free" />Free</div>
      {log.length > 0 && <div className="vis-log">{log.map((entry, i) => <div key={i}>{entry}</div>)}</div>}
      <p className="vis-note">The bar above represents {BUDDY_TOTAL} units of memory. Allocation rounds up to the nearest power of two and splits the smallest available block. Two free aligned buddies of equal size merge automatically on release.</p>
    </div>
  );
}

// ─── Paging ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 256; // bytes — offset = 8 bits
const PAGE_TABLE: Record<number, number | null> = { 0: 3, 1: 7, 2: 1, 3: null }; // null = absent
const NUM_PAGES = 4;

export function PagingVisualizer() {
  const [logicalAddr, setLogicalAddr] = useState(512);
  const pageNum = Math.floor(logicalAddr / PAGE_SIZE);
  const offset = logicalAddr % PAGE_SIZE;
  const frame = pageNum < NUM_PAGES ? PAGE_TABLE[pageNum] : undefined;
  const physicalAddr = frame !== undefined && frame !== null ? frame * PAGE_SIZE + offset : null;
  const absent = frame === null;
  const invalid = pageNum >= NUM_PAGES;

  return (
    <div className="vis-root">
      <div className="vis-header"><span className="vis-title"><Zap size={15} /> Paging — page size 256 B, 4 pages, 8 frames</span></div>
      <div className="paging-layout">
        <div className="page-table-card">
          <div className="ptable-head">Page Table</div>
          {Array.from({ length: NUM_PAGES }, (_, p) => (
            <div key={p} className={`ptable-row ${p === pageNum ? 'highlight' : ''}`}>
              <span>Page {p}</span>
              <ArrowRight size={13} />
              <span>{PAGE_TABLE[p] !== null ? `Frame ${PAGE_TABLE[p]}` : <em>absent</em>}</span>
            </div>
          ))}
        </div>
        <div className="paging-main">
          <label className="vis-label">Logical address (0–1023)
            <input type="number" min={0} max={1023} value={logicalAddr} onChange={(e) => setLogicalAddr(Math.max(0, Math.min(1023, Number(e.target.value))))} />
          </label>
          <div className="addr-breakdown">
            <div className="addr-part page"><span>Page number</span><strong>{invalid ? '—' : pageNum}</strong><small>bits 9–8</small></div>
            <div className="addr-sep"><ChevronRight size={18} /></div>
            <div className="addr-part offset"><span>Offset</span><strong>{offset}</strong><small>bits 7–0</small></div>
          </div>
          {invalid && <div className="vis-error">Page {pageNum} is outside the 4-page virtual address space.</div>}
          {absent && !invalid && <div className="vis-error">Page {pageNum} is not in memory — this triggers a page fault. The OS would load it from secondary storage.</div>}
          {physicalAddr !== null && !invalid && (
            <div className="addr-result">
              <div className="addr-part frame"><span>Frame {frame}</span><strong>Physical address</strong><strong className="big-addr">{physicalAddr}</strong><small>frame {frame} × 256 + offset {offset}</small></div>
            </div>
          )}
        </div>
      </div>
      <p className="vis-note">Change the logical address above. The page number selects the frame from the page table; the offset is appended unchanged. A page table entry marked absent causes a page fault.</p>
    </div>
  );
}

// ─── TCP Three-Way Handshake ─────────────────────────────────────────────────

const TCP_STEPS = [
  { from: 'client', msg: 'SYN', seqLabel: 'SEQ=x', detail: 'The client picks a random initial sequence number x and sends a SYN (synchronize) segment to start the connection.', clientState: 'SYN_SENT', serverState: 'LISTEN' },
  { from: 'server', msg: 'SYN-ACK', seqLabel: 'SEQ=y, ACK=x+1', detail: 'The server picks its own initial sequence y, acknowledges x+1 (the next byte it expects), and sends SYN-ACK. Both sides have now announced their sequence numbers.', clientState: 'SYN_SENT', serverState: 'SYN_RCVD' },
  { from: 'client', msg: 'ACK', seqLabel: 'ACK=y+1', detail: "The client acknowledges the server's SYN by sending ACK=y+1. The connection is now ESTABLISHED on both sides and data transfer can begin.", clientState: 'ESTABLISHED', serverState: 'ESTABLISHED' },
];

export function TCPHandshakeVisualizer() {
  const [step, setStep] = useState(-1); // -1 = idle
  const active = TCP_STEPS.slice(0, step + 1);
  const current = step >= 0 && step < TCP_STEPS.length ? TCP_STEPS[step] : null;
  const done = step === TCP_STEPS.length - 1;

  return (
    <div className="vis-root">
      <div className="vis-header">
        <span className="vis-title"><Zap size={15} /> TCP Three-Way Handshake</span>
        <button className="vis-btn outline" onClick={() => setStep(-1)}><RotateCcw size={13} /> Reset</button>
      </div>
      <div className="tcp-layout">
        <div className="tcp-actor client"><div className="actor-box">Client</div><div className="actor-state">{step === -1 ? 'CLOSED' : step < 2 ? 'SYN_SENT' : 'ESTABLISHED'}</div><div className="actor-line" /></div>
        <div className="tcp-messages">
          {active.map((s, i) => (
            <div key={i} className={`tcp-msg ${s.from}`}>
              <span className="tcp-arrow">{s.from === 'client' ? '→' : '←'}</span>
              <span className="tcp-label">{s.msg}</span>
              <span className="tcp-seq">{s.seqLabel}</span>
            </div>
          ))}
          {step === -1 && <div className="tcp-idle">Press Next to start the handshake</div>}
          {done && <div className="tcp-done"><Check size={15} /> Connection ESTABLISHED — data transfer can begin</div>}
        </div>
        <div className="tcp-actor server"><div className="actor-box">Server</div><div className="actor-state">{step === -1 ? 'LISTEN' : step === 0 ? 'LISTEN' : step === 1 ? 'SYN_RCVD' : 'ESTABLISHED'}</div><div className="actor-line" /></div>
      </div>
      {current && <div className="tcp-detail"><strong>Step {step + 1}: {current.msg}</strong><p>{current.detail}</p></div>}
      <div className="vis-controls">
        <button className="vis-btn primary" onClick={() => setStep((s) => Math.min(s + 1, TCP_STEPS.length - 1))} disabled={done}>Next step</button>
        <span className="vis-step-count">Step {Math.max(0, step + 1)} / {TCP_STEPS.length}</span>
      </div>
    </div>
  );
}

// ─── Generic flowchart for remaining topics ──────────────────────────────────

const FLOWCHARTS: Record<string, { nodes: string[]; edges: [number, number][]; note: string }> = {
  segmentation: {
    nodes: ['Logical address\n(segment, offset)', 'Segment table\nlookup', 'Limit check\noffset < limit?', 'Violation →\nprotection fault', 'Physical address\nbase + offset'],
    edges: [[0, 1], [1, 2], [2, 3], [2, 4]],
    note: 'Each segment has a base and limit. The offset must be smaller than the limit; otherwise, the OS raises a protection fault.',
  },
  'cpu-scheduling': {
    nodes: ['Process arrives\n→ ready queue', 'Scheduler\npicks next process', 'CPU runs process', 'Time quantum\nexpires?', 'Process\ncompletes', 'Back to\nready queue'],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5], [5, 1]],
    note: 'If preemptive (e.g. Round Robin), an expiring quantum sends the process back to the queue. Otherwise it runs to completion or a blocking event.',
  },
  deadlocks: {
    nodes: ['Process holds\nResource A', 'Process requests\nResource B', 'Resource B held\nby another process', 'Circular wait\nforms', 'Deadlock\ndetected / prevented'],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
    note: 'Deadlock requires all four conditions: mutual exclusion, hold-and-wait, no preemption, and circular wait. Break any one to prevent it.',
  },
  'ip-addressing': {
    nodes: ['IP Address\n(32 bits)', 'Apply\nsubnet mask', 'Network\nportion (prefix)', 'Host\nportion', 'Local delivery\nor route to next hop'],
    edges: [[0, 1], [1, 2], [1, 3], [2, 4]],
    note: 'The subnet mask ANDed with the IP address gives the network address. Routers use the network portion to select the next hop.',
  },
  routing: {
    nodes: ['Incoming\npacket', 'Routing table\nlookup', 'Longest prefix\nmatch', 'Next hop /\ninterface', 'Packet\nforwarded'],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
    note: 'The most specific matching route wins. If no route matches, the default route (0.0.0.0/0) is used as a fallback.',
  },
  normalization: {
    nodes: ['Unnormalized\ntable', 'Identify functional\ndependencies', '1NF — atomic\ncolumns only', '2NF — remove\npartial dependencies', '3NF — remove\ntransitive deps'],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
    note: 'Each normal form removes a class of anomaly. Higher forms produce cleaner schemas but may require more joins when reading data.',
  },
  'sql-joins': {
    nodes: ['Table A\n(e.g. Students)', 'Join condition\n(A.id = B.id)', 'Table B\n(e.g. Enrollments)', 'INNER JOIN\nmatches only', 'LEFT JOIN\nall of A + matches'],
    edges: [[0, 1], [2, 1], [1, 3], [1, 4]],
    note: 'INNER JOIN keeps only rows that satisfy the condition. LEFT JOIN keeps every row in A and fills missing B columns with NULL.',
  },
  transactions: {
    nodes: ['BEGIN\ntransaction', 'Read / write\noperations', 'Constraint\ncheck OK?', 'COMMIT →\ndurable change', 'ROLLBACK →\nundo all changes'],
    edges: [[0, 1], [1, 2], [2, 3], [2, 4]],
    note: 'Atomicity means COMMIT and ROLLBACK are the only outcomes. Durability ensures committed data survives crashes.',
  },
};

export function FlowchartVisualizer({ topicId }: { topicId: string }) {
  const chart = FLOWCHARTS[topicId];
  if (!chart) return <div className="vis-unavailable">No diagram is available for this topic yet.</div>;
  return (
    <div className="vis-root">
      <div className="vis-header"><span className="vis-title"><Zap size={15} /> Concept flowchart</span></div>
      <div className="flowchart">
        {chart.nodes.map((label, i) => {
          const incoming = chart.edges.filter(([, t]) => t === i);
          return (
            <div key={i} className="flow-step">
              {incoming.length > 0 && <div className="flow-connector"><ArrowRight size={14} /></div>}
              <div className="flow-node">{label.split('\n').map((line, j) => <span key={j}>{line}</span>)}</div>
            </div>
          );
        })}
      </div>
      <p className="vis-note">{chart.note}</p>
    </div>
  );
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export function TopicVisualizer({ topicId }: { topicId: string }) {
  if (topicId === 'buddy-system') return <BuddyVisualizer />;
  if (topicId === 'paging') return <PagingVisualizer />;
  if (topicId === 'tcp-handshake') return <TCPHandshakeVisualizer />;
  return <FlowchartVisualizer topicId={topicId} />;
}
