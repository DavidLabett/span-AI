import { colors } from '../theme'

interface StatusBarProps {
  projectName: string
  filePath: string | null
  isDirty: boolean
  nodeCount: number
  undoCount: number
  redoCount: number
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 5,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    zIndex: 100,
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  version: {
    color: colors.sapphire,
    letterSpacing: '0.1em',
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 5,
  },
  filename: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  filenameText: {
    color: colors.subtext0,
  },
  dirtyDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: colors.peach,
  },
  nodeCount: {
    color: colors.overlay0,
  },
  historyCount: {
    color: colors.surface2,
    fontSize: 10,
  },
}

export function StatusBar({ 
  projectName, 
  filePath, 
  isDirty, 
  nodeCount,
  undoCount,
  redoCount,
}: StatusBarProps) {
  // Extract just the filename from the path
  const displayName = filePath 
    ? filePath.split(/[/\\]/).pop()?.replace('.json', '') || projectName
    : projectName

  return (
    <div style={styles.container}>
      {/* Top row */}
      <div style={styles.topRow}>
        {/* Top-left: Version */}
        <span style={styles.version}>&lt;span/&gt; v0.8</span>
        
        {/* Top-right: Filename, dirty, node count, history (column) */}
        <div style={styles.rightColumn}>
          <div style={styles.filename}>
            {isDirty && <div style={styles.dirtyDot} title="Unsaved changes" />}
            <span style={styles.filenameText}>{displayName}</span>
          </div>
          <span style={styles.nodeCount}>
            {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}
          </span>
          <span style={styles.historyCount}>
            ↶{undoCount} ↷{redoCount}
          </span>
        </div>
      </div>

      {/* Bottom row - empty for now */}
      <div></div>
    </div>
  )
}
