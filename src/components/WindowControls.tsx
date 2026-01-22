import { useState } from 'react'

const styles: Record<string, React.CSSProperties & { WebkitAppRegion?: string }> = {
  container: {
    position: 'fixed',
    top: 0,
    right: 0,
    height: '20px',
    display: 'flex',
    gap: 4,
    alignItems: 'center',
    paddingRight: 8,
    paddingTop: 0,
    zIndex: 99999,
    WebkitAppRegion: 'no-drag',
    pointerEvents: 'auto',
  },
  button: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 150ms ease-out',
    padding: 0,
    WebkitAppRegion: 'no-drag',
    pointerEvents: 'auto',
    outline: 'none',
    flexShrink: 0,
    opacity: 0.6,
  },
  closeButton: {
    backgroundColor: '#e03131',
  },
  minimizeButton: {
    backgroundColor: '#dee5fc',
  },
  maximizeButton: {
    backgroundColor: '#d5dcf5',
  },
}

export function WindowControls() {
  const [hovered, setHovered] = useState<string | null>(null)

  const handleMinimize = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await window.electronAPI.windowMinimize()
    } catch (error) {
      console.error('Failed to minimize window:', error)
    }
  }

  const handleMaximize = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await window.electronAPI.windowMaximize()
    } catch (error) {
      console.error('Failed to maximize window:', error)
    }
  }

  const handleClose = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await window.electronAPI.windowClose()
    } catch (error) {
      console.error('Failed to close window:', error)
    }
  }

  const getButtonStyle = (buttonType: string) => {
    const baseStyle = { ...styles.button }
    const typeStyle = styles[`${buttonType}Button` as keyof typeof styles] || {}
    const isHovered = hovered === buttonType
    
    return {
      ...baseStyle,
      ...typeStyle,
      opacity: isHovered ? 0.8 : 0.6,
    }
  }

  return (
    <div 
      style={styles.container}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        style={getButtonStyle('minimize')}
        onClick={handleMinimize}
        onMouseEnter={() => setHovered('minimize')}
        onMouseLeave={() => setHovered(null)}
        onMouseDown={(e) => e.stopPropagation()}
        title="Minimize"
      />
      <button
        style={getButtonStyle('maximize')}
        onClick={handleMaximize}
        onMouseEnter={() => setHovered('maximize')}
        onMouseLeave={() => setHovered(null)}
        onMouseDown={(e) => e.stopPropagation()}
        title="Maximize"
      />
      <button
        style={getButtonStyle('close')}
        onClick={handleClose}
        onMouseEnter={() => setHovered('close')}
        onMouseLeave={() => setHovered(null)}
        onMouseDown={(e) => e.stopPropagation()}
        title="Close"
      />
    </div>
  )
}
