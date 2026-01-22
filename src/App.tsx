import { useState } from 'react'
import { Canvas } from './components/Canvas'
import { WelcomeScreen } from './components/WelcomeScreen'
import { WindowControls } from './components/WindowControls'

function App() {
  const [hasProject, setHasProject] = useState(false)
  const [projectPath, setProjectPath] = useState<string | undefined>(undefined)

  const handleNewProject = () => {
    setProjectPath(undefined)
    setHasProject(true)
  }

  const handleOpenProject = (filePath: string) => {
    setProjectPath(filePath)
    setHasProject(true)
  }

  return (
    <div className="app">
      <div className="titlebar-drag-region" />
      <WindowControls />
      <main className="canvas-container">
        {hasProject ? (
          <Canvas initialProjectPath={projectPath} />
        ) : (
          <WelcomeScreen 
            onNewProject={handleNewProject}
            onOpenProject={handleOpenProject}
          />
        )}
      </main>
    </div>
  )
}

export default App
