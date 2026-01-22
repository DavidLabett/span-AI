import { useEffect, useState } from 'react';
import '../styles/WelcomeScreen.css';

interface WelcomeScreenProps {
  onNewProject: () => void;
  onOpenProject: (filePath: string) => void;
}

export function WelcomeScreen({ onNewProject, onOpenProject }: WelcomeScreenProps) {
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [projectsPath, setProjectsPath] = useState<string>('');
  const [loadingPath, setLoadingPath] = useState(true);

  useEffect(() => {
    loadRecentProjects();
    loadProjectsPath();
  }, []);

  const loadProjectsPath = async () => {
    try {
      const path = await window.electronAPI.getProjectsPath();
      setProjectsPath(path);
    } catch (error) {
      console.error('Failed to load projects path:', error);
    } finally {
      setLoadingPath(false);
    }
  };

  const loadRecentProjects = async () => {
    try {
      const projects = await window.electronAPI.listRecentProjects();
      setRecentProjects(projects);
    } catch (error) {
      console.error('Failed to load recent projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const handleSelectFolder = async () => {
    const selectedPath = await window.electronAPI.showSelectFolderDialog();
    if (selectedPath) {
      const result = await window.electronAPI.setProjectsPath(selectedPath);
      if (result.success) {
        setProjectsPath(selectedPath);
        // Reload recent projects with new path
        await loadRecentProjects();
      } else {
        console.error('Failed to set projects path:', result.error);
        alert('Failed to set projects path: ' + result.error);
      }
    }
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        {/* Large "span" title */}
        <h1 className="welcome-title">&lt;span&gt;</h1>
        
        {/* Recent Projects Section */}
        <div className="recent-projects">
          <div className="recent-projects-header">
            <h2 className="recent-projects-title">Recent Projects</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="new-project-button"
                onClick={() => setShowSettings(!showSettings)}
                title="Settings"
              >
                ⚙
              </button>
              <button 
                className="new-project-button"
                onClick={onNewProject}
              >
                New Project
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="settings-panel">
              <div className="settings-header">
                <h3 className="settings-title">Projects Folder</h3>
                <button 
                  className="new-project-button"
                  onClick={() => setShowSettings(false)}
                  style={{ fontSize: '14px' }}
                >
                  ✕
                </button>
              </div>
              <div className="settings-content">
                <div className="settings-path-display">
                  {loadingPath ? 'Loading...' : projectsPath}
                </div>
                <div className="settings-actions">
                  <button 
                    className="settings-button"
                    onClick={handleSelectFolder}
                  >
                    Change Folder
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {loading ? (
            <div className="loading-state">Loading...</div>
          ) : recentProjects.length === 0 ? (
            <div className="empty-state">
              <p>No recent projects</p>
              <button 
                className="new-project-button"
                onClick={onNewProject}
              >
                Start with a new project
              </button>
            </div>
          ) : (
            <ul className="project-list">
              {recentProjects.map((project) => (
                <li 
                  key={project.filePath}
                  className="project-item"
                  onClick={() => onOpenProject(project.filePath)}
                >
                  <div className="project-name">{project.name}</div>
                  <div className="project-meta">
                    Modified {formatDate(project.modified)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <h1 className="welcome-title">&lt;span/&gt;</h1>
      </div>
    </div>
  );
}